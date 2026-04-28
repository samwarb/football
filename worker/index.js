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

const ESPN_STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings';
const ESPN_NEWS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=30';
const SKY_RSS_URL = 'https://www.skysports.com/rss/12040';
const SKY_RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(SKY_RSS_URL)}`;
const TV_SOURCE = 'https://www.live-footballontv.com/live-english-football-on-tv.html';
const CACHE_PREFIX = 'football:';

const TTL = {
  standings: 5 * 60 * 1000,
  round: 2 * 60 * 1000,
  season: 20 * 60 * 1000,
  news: 15 * 60 * 1000,
  tv: 24 * 60 * 60 * 1000
};

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

const memoryCache = globalThis.__MATCHDAY_LEDGER_CACHE__ || new Map();
globalThis.__MATCHDAY_LEDGER_CACHE__ = memoryCache;

const inFlight = new Map();

function sportsDbRoundUrl(round) {
  return `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${SPORTSDB_LEAGUE}&r=${round}&s=${SEASON}`;
}

function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    ...extra
  };
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30, s-maxage=60',
      ...extraHeaders
    })
  });
}

function errorResponse(status, message, detail) {
  return jsonResponse({
    error: {
      message,
      detail: detail ? String(detail) : undefined
    }
  }, status, {
    'cache-control': 'no-store'
  });
}

function cacheStorage(env) {
  return env?.FOOTBALL_CACHE || null;
}

async function readCache(env, key) {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const kv = cacheStorage(env);
  if (kv?.get) return kv.get(fullKey, 'json');
  return memoryCache.get(fullKey) || null;
}

async function writeCache(env, key, record) {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const kv = cacheStorage(env);
  if (kv?.put) {
    await kv.put(fullKey, JSON.stringify(record));
    return;
  }
  memoryCache.set(fullKey, record);
}

async function listCacheKeys(env) {
  const kv = cacheStorage(env);
  if (kv?.list) {
    const result = await kv.list({ prefix: CACHE_PREFIX, limit: 50 });
    return result.keys.map(key => key.name.replace(CACHE_PREFIX, ''));
  }
  return [...memoryCache.keys()]
    .filter(key => key.startsWith(CACHE_PREFIX))
    .map(key => key.replace(CACHE_PREFIX, ''));
}

async function cached(env, key, ttlMs, loader, options = {}) {
  const now = Date.now();
  const hit = await readCache(env, key);

  if (!options.force && hit?.expiresAt > now) {
    return {
      ...hit.value,
      meta: {
        ...(hit.value.meta || {}),
        cache: 'hit'
      }
    };
  }

  const pendingKey = `${key}:${options.force ? 'force' : 'normal'}`;
  if (inFlight.has(pendingKey)) return inFlight.get(pendingKey);

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

      await writeCache(env, key, {
        value: wrapped,
        expiresAt: now + ttlMs
      });

      return wrapped;
    } catch (error) {
      if (hit?.value) {
        return {
          ...hit.value,
          meta: {
            ...(hit.value.meta || {}),
            cache: 'stale',
            warning: error.message
          }
        };
      }
      throw error;
    } finally {
      inFlight.delete(pendingKey);
    }
  })();

  inFlight.set(pendingKey, pending);
  return pending;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: options.accept || 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'MatchdayLedger/0.3 (+https://samwarb.github.io/football/)'
      },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return options.text ? response.text() : response.json();
  } finally {
    clearTimeout(timeout);
  }
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

export async function getStandings(env, options = {}) {
  return cached(env, 'standings', TTL.standings, async () => {
    const raw = await fetchWithTimeout(ESPN_STANDINGS);
    return normalizeStandings(raw);
  }, options);
}

export async function getRound(env, round, options = {}) {
  const safeRound = Math.max(1, Math.min(ROUND_COUNT, Number.parseInt(round, 10) || 1));
  return cached(env, `round:${safeRound}`, TTL.round, async () => {
    const raw = await fetchWithTimeout(sportsDbRoundUrl(safeRound));
    const fixtures = (raw.events || []).map(normalizeFixture);
    return {
      season: SEASON,
      round: safeRound,
      fixtures
    };
  }, options);
}

export async function estimateCurrentRound(env, options = {}) {
  const standings = await getStandings(env, options);
  const playedCounts = (standings.teams || [])
    .map(team => Number.parseInt(team.played, 10))
    .filter(Number.isFinite);
  const maxPlayed = Math.max(...playedCounts, 1);
  return Math.max(1, Math.min(ROUND_COUNT, maxPlayed));
}

export async function getSeason(env, options = {}) {
  return cached(env, 'season-window', TTL.season, async () => {
    const currentRound = await estimateCurrentRound(env, options);
    const firstRound = Math.max(1, currentRound - 5);
    const lastRound = Math.min(ROUND_COUNT, currentRound + 2);
    const rounds = Array.from(
      { length: lastRound - firstRound + 1 },
      (_, index) => firstRound + index
    );
    const roundPayloads = await mapLimit(rounds, 5, async round => {
      try {
        const payload = await getRound(env, round, options);
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
  }, options);
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

export async function getNews(env, options = {}) {
  return cached(env, 'news', TTL.news, async () => {
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
  }, options);
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

export async function getTvListings(env, options = {}) {
  return cached(env, 'tv', TTL.tv, async () => {
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
  }, options);
}

async function getRoundWithTv(env, round, options = {}) {
  const [roundPayload, tvPayload] = await Promise.allSettled([
    getRound(env, round, options),
    getTvListings(env)
  ]);

  if (roundPayload.status === 'rejected') throw roundPayload.reason;

  const tvLookup = tvPayload.status === 'fulfilled' ? tvPayload.value.fixtures || {} : {};
  return {
    ...roundPayload.value,
    fixtures: (roundPayload.value.fixtures || []).map(fixture => ({
      ...fixture,
      tvChannels: tvLookup[fixtureKey(fixture.home.name, fixture.away.name)] || []
    })),
    warnings: tvPayload.status === 'rejected' ? [`TV: ${tvPayload.reason.message}`] : undefined
  };
}

async function refreshAll(env, options = {}) {
  const startedAt = new Date().toISOString();
  const tasks = [
    ['standings', () => getStandings(env, options)],
    ['season', () => getSeason(env, options)],
    ['news', () => getNews(env, options)],
    ['tv', () => getTvListings(env, options)]
  ];

  const currentRound = await estimateCurrentRound(env).catch(() => 34);
  for (const round of [currentRound - 1, currentRound, currentRound + 1]) {
    if (round >= 1 && round <= ROUND_COUNT) {
      tasks.push([`round:${round}`, () => getRound(env, round, options)]);
    }
  }

  const settled = await Promise.allSettled(tasks.map(([, task]) => task()));
  return {
    ok: settled.every(result => result.status === 'fulfilled'),
    startedAt,
    finishedAt: new Date().toISOString(),
    results: settled.map((result, index) => ({
      key: tasks[index][0],
      ok: result.status === 'fulfilled',
      warning: result.status === 'rejected' ? result.reason.message : undefined
    }))
  };
}

function authToken(request, url) {
  const header = request.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return url.searchParams.get('token') || '';
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (pathname === '/' || pathname === '/v1') {
    return jsonResponse({
      name: 'Matchday Ledger API',
      version: env?.API_VERSION || 'v1',
      season: SEASON,
      routes: [
        '/v1/standings',
        '/v1/current-round',
        '/v1/fixtures/current',
        '/v1/fixtures/round/:round',
        '/v1/season',
        '/v1/news',
        '/v1/tv',
        '/v1/health'
      ]
    });
  }

  try {
    if (pathname === '/v1/standings' || pathname === '/api/standings') {
      return jsonResponse(await getStandings(env));
    }

    if (pathname === '/v1/season' || pathname === '/api/season') {
      return jsonResponse(await getSeason(env));
    }

    if (pathname === '/v1/news' || pathname === '/api/news') {
      return jsonResponse(await getNews(env));
    }

    if (pathname === '/v1/tv' || pathname === '/api/tv') {
      return jsonResponse(await getTvListings(env));
    }

    if (pathname === '/v1/current-round' || pathname === '/api/current-round') {
      return jsonResponse({
        season: SEASON,
        round: await estimateCurrentRound(env)
      });
    }

    if (pathname === '/v1/fixtures/current') {
      const round = await estimateCurrentRound(env);
      return jsonResponse(await getRoundWithTv(env, round));
    }

    const v1RoundMatch = pathname.match(/^\/v1\/fixtures\/round\/(\d+)$/);
    const apiRoundMatch = pathname.match(/^\/api\/round\/(\d+)$/);
    const roundMatch = v1RoundMatch || apiRoundMatch;
    if (roundMatch) return jsonResponse(await getRoundWithTv(env, roundMatch[1]));

    if (pathname === '/v1/health' || pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        season: SEASON,
        version: env?.API_VERSION || 'v1',
        storage: cacheStorage(env) ? 'kv' : 'memory',
        cacheKeys: await listCacheKeys(env)
      }, 200, {
        'cache-control': 'no-store'
      });
    }

    if (pathname === '/v1/admin/refresh') {
      if (request.method !== 'POST') return errorResponse(405, 'Refresh must use POST');
      if (!env?.ADMIN_TOKEN) return errorResponse(404, 'Refresh endpoint is not enabled');
      if (authToken(request, url) !== env.ADMIN_TOKEN) return errorResponse(401, 'Unauthorized refresh request');
      const refresh = refreshAll(env, { force: true });
      ctx?.waitUntil?.(refresh);
      return jsonResponse({
        ok: true,
        refresh: 'started'
      }, 202, {
        'cache-control': 'no-store'
      });
    }

    return errorResponse(404, 'Unknown API route');
  } catch (error) {
    return errorResponse(502, 'Data provider request failed', error.message);
  }
}

export default {
  async fetch(request, env, ctx) {
    return route(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshAll(env));
  }
};
