import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ROUND_COUNT,
  SEASON,
  SPORTSDB_LEAGUE,
  decodeEntities,
  fixtureKey,
  normalizeFixture,
  normalizeStandings,
  stripHtml
} from '../src/normalizers.js';
import { PREMIER_LEAGUE_TEAMS } from '../src/teamIdentity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number.parseInt(process.env.PORT || '4173', 10);

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings';
const ESPN_NEWS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=30';
const SKY_RSS_URL = 'https://www.skysports.com/rss/12040';
const SKY_RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(SKY_RSS_URL)}`;
const TV_SOURCE = 'https://www.live-footballontv.com/live-english-football-on-tv.html';
const SKY_NON_FOOTBALL = /\/(tennis|nba|f1|cricket|rugby|golf|boxing|darts|nfl|mma|wwe|racing|netball|snooker)\//i;
const SKY_BLOCKED_TERMS = /\b(snooker|cricket|ipl|darts|golf|formula 1|f1|rugby|tennis|nfl|nba|boxing|mma|wwe|racing|netball|solheim|pdc)\b/i;
const SKY_FOOTBALL_TERMS = new RegExp(
  [
    'football',
    'premier league',
    'fa cup',
    'carabao cup',
    'champions league',
    'europa league',
    ...PREMIER_LEAGUE_TEAMS.flatMap(team => [team.displayName, team.shortName, ...team.aliases])
  ]
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i'
);

const cache = new Map();
const inFlight = new Map();

function sportsDbRoundUrl(round) {
  return `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${SPORTSDB_LEAGUE}&r=${round}&s=${SEASON}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message, detail) {
  sendJson(res, status, {
    error: {
      message,
      detail: detail ? String(detail) : undefined
    }
  });
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'accept': options.accept || 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'MatchdayLedger/0.2 (+local development)'
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return options.text ? response.text() : response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return { ...hit.value, meta: { ...hit.value.meta, cache: 'hit' } };
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const pending = (async () => {
    try {
      const value = await loader();
      const wrapped = {
        ...value,
        meta: {
          ...(value.meta || {}),
          cache: 'fresh',
          cachedAt: new Date().toISOString()
        }
      };
      cache.set(key, { value: wrapped, expiresAt: now + ttlMs });
      return wrapped;
    } catch (error) {
      if (hit) {
        return {
          ...hit.value,
          meta: {
            ...hit.value.meta,
            cache: 'stale',
            warning: error.message
          }
        };
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, pending);
  return pending;
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function getStandings() {
  return cached('standings', 5 * 60 * 1000, async () => {
    const raw = await fetchWithTimeout(ESPN_STANDINGS);
    return normalizeStandings(raw);
  });
}

export async function getRound(round) {
  const safeRound = Math.max(1, Math.min(ROUND_COUNT, Number.parseInt(round, 10) || 1));
  return cached(`round:${safeRound}`, 60 * 1000, async () => {
    const raw = await fetchWithTimeout(sportsDbRoundUrl(safeRound));
    const fixtures = (raw.events || []).map(normalizeFixture);
    return {
      season: SEASON,
      round: safeRound,
      fixtures
    };
  });
}

export async function getSeason() {
  return cached('season-window', 20 * 60 * 1000, async () => {
    const currentRound = await estimateCurrentRound();
    const firstRound = Math.max(1, currentRound - 5);
    const lastRound = Math.min(ROUND_COUNT, currentRound + 2);
    const rounds = Array.from(
      { length: lastRound - firstRound + 1 },
      (_, index) => firstRound + index
    );
    const roundPayloads = await mapLimit(rounds, 5, async round => {
      try {
        const payload = await getRound(round);
        return { round, fixtures: payload.fixtures || [] };
      } catch (error) {
        return {
          round,
          fixtures: [],
          warning: error.message
        };
      }
    });

    const fixtures = roundPayloads.flatMap(payload => payload.fixtures);
    return {
      season: SEASON,
      currentRound,
      complete: false,
      scope: `Rounds ${firstRound}-${lastRound}`,
      rounds: roundPayloads,
      fixtures,
      warnings: roundPayloads.filter(payload => payload.warning)
    };
  });
}

export async function estimateCurrentRound() {
  const standings = await getStandings();
  const playedCounts = (standings.teams || [])
    .map(team => Number.parseInt(team.played, 10))
    .filter(Number.isFinite);
  const maxPlayed = Math.max(...playedCounts, 1);
  return Math.max(1, Math.min(ROUND_COUNT, maxPlayed));
}

function normalizeEspnArticle(article) {
  const categories = article.categories || [];
  return {
    id: article.id || article.dataSourceIdentifier || article.headline,
    source: 'ESPN',
    headline: stripHtml(article.headline || article.title || 'Untitled'),
    description: stripHtml(article.description || ''),
    publishedAt: article.published || article.lastModified || null,
    image: article.images?.[0]?.url || '',
    link: article.links?.web?.href || '',
    tag: stripHtml(categories.find(category => category.type === 'team')?.description || article.type || 'Premier League'),
    teams: categories
      .filter(category => category.type === 'team')
      .map(category => stripHtml(category.description))
      .filter(Boolean)
  };
}

function normalizeSkyArticle(item) {
  return {
    id: item.guid || item.link || item.title,
    source: 'Sky Sports',
    headline: stripHtml(item.title || 'Untitled'),
    description: stripHtml(item.description || ''),
    publishedAt: item.pubDate ? new Date(item.pubDate.replace(' ', 'T') + 'Z').toISOString() : null,
    image: item.thumbnail || item.enclosure?.link || '',
    link: item.link || '',
    tag: stripHtml(item.categories?.[0] || 'Football'),
    teams: []
  };
}

function isSkyFootballItem(item) {
  const link = item.link || '';
  const text = stripHtml([
    item.title,
    item.description,
    item.content,
    ...(item.categories || [])
  ].join(' '));

  if (/\/football\//i.test(link)) return true;
  if (SKY_NON_FOOTBALL.test(link) || SKY_BLOCKED_TERMS.test(text)) return false;
  return SKY_FOOTBALL_TERMS.test(text);
}

export async function getNews() {
  return cached('news', 5 * 60 * 1000, async () => {
    const [espn, sky] = await Promise.allSettled([
      fetchWithTimeout(ESPN_NEWS),
      fetchWithTimeout(SKY_RSS2JSON)
    ]);

    const articles = [];
    const warnings = [];

    if (espn.status === 'fulfilled') {
      articles.push(...(espn.value.articles || []).map(normalizeEspnArticle));
    } else {
      warnings.push(`ESPN: ${espn.reason.message}`);
    }

    if (sky.status === 'fulfilled' && sky.value.status === 'ok') {
      articles.push(...(sky.value.items || [])
        .filter(isSkyFootballItem)
        .map(normalizeSkyArticle));
    } else if (sky.status === 'fulfilled') {
      warnings.push(`Sky Sports: rss2json status ${sky.value.status}`);
    } else {
      warnings.push(`Sky Sports: ${sky.reason.message}`);
    }

    articles.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    return {
      season: SEASON,
      articles,
      warnings
    };
  });
}

function extractTag(block, className) {
  const pattern = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  return stripHtml(block.match(pattern)?.[1] || '');
}

function extractChannels(block) {
  const channels = [];
  const pattern = /<[^>]*class=["'][^"']*channel-pill[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let match = pattern.exec(block);
  while (match) {
    const channel = stripHtml(match[1]);
    const lower = channel.toLowerCase();
    const wanted = ['sky', 'tnt', 'amazon', 'prime', 'bbc', 'itv', 'premier league', 'hbo'];
    if (channel && !lower.includes('ultra hdr') && wanted.some(item => lower.includes(item))) {
      channels.push(channel);
    }
    match = pattern.exec(block);
  }
  return [...new Set(channels)];
}

function parseTvListings(html) {
  const fixtures = {};
  const blocks = html.match(/<div\s+class=["']fixture["'][^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];

  for (const block of blocks) {
    const competition = extractTag(block, 'fixture__competition');
    if (competition !== 'Premier League') continue;
    const teams = decodeEntities(extractTag(block, 'fixture__teams'));
    const channels = extractChannels(block);
    if (!teams || !channels.length) continue;

    const parts = teams.split(/\s+v\s+/i);
    if (parts.length !== 2) continue;
    fixtures[fixtureKey(parts[0], parts[1])] = channels;
  }

  return fixtures;
}

export async function getTvListings() {
  return cached('tv', 15 * 60 * 1000, async () => {
    const html = await fetchWithTimeout(TV_SOURCE, {
      text: true,
      timeoutMs: 12000,
      accept: 'text/html,*/*'
    });
    const fixtures = parseTvListings(html);
    return {
      season: SEASON,
      source: TV_SOURCE,
      fixtures,
      warning: Object.keys(fixtures).length ? null : 'No Premier League broadcasts were parsed from the TV source.'
    };
  });
}

async function apiRouter(req, res, url) {
  try {
    if (url.pathname === '/api/standings') return sendJson(res, 200, await getStandings());
    if (url.pathname === '/api/season') return sendJson(res, 200, await getSeason());
    if (url.pathname === '/api/news') return sendJson(res, 200, await getNews());
    if (url.pathname === '/api/tv') return sendJson(res, 200, await getTvListings());

    const roundMatch = url.pathname.match(/^\/api\/round\/(\d+)$/);
    if (roundMatch) return sendJson(res, 200, await getRound(roundMatch[1]));

    if (url.pathname === '/api/current-round') {
      return sendJson(res, 200, {
        season: SEASON,
        round: await estimateCurrentRound()
      });
    }

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        season: SEASON,
        cache: [...cache.entries()].map(([key, value]) => ({
          key,
          expiresAt: new Date(value.expiresAt).toISOString(),
          cachedAt: value.value.meta?.cachedAt
        }))
      });
    }

    return sendError(res, 404, 'Unknown API route');
  } catch (error) {
    return sendError(res, 502, 'Data provider request failed', error.message);
  }
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp']
]);

async function staticRouter(req, res, url) {
  const requested = decodeURIComponent(url.pathname);
  const relativePath = requested === '/' ? 'index.html' : requested.slice(1);
  const filePath = path.resolve(rootDir, relativePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(finalPath);
    const body = await fs.readFile(finalPath);
    res.writeHead(200, {
      'content-type': mimeTypes.get(ext) || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return apiRouter(req, res, url);
  return staticRouter(req, res, url);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, () => {
    console.log(`Matchday Ledger running at http://localhost:${port}`);
  });
}
