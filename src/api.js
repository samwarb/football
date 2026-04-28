const localApiHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const hasLocalApi = localApiHosts.has(window.location.hostname);
const apiMode = new URLSearchParams(window.location.search).get('api');
const cloudflareApiBase = 'https://matchday-ledger-api.swgwarburton.workers.dev/v1';

export async function getJson(path) {
  if (apiMode === 'static' && path.startsWith('/api/')) {
    return getStaticJson(path);
  }

  const primaryPath = primaryPathFor(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(primaryPath, { signal: controller.signal });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message || `HTTP ${response.status}`);
    }
    return body;
  } catch (error) {
    if (path.startsWith('/api/')) {
      return getStaticJson(path);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function primaryPathFor(path) {
  if (!path.startsWith('/api/')) return path;
  if (apiMode === 'cloudflare' || !hasLocalApi) return cloudflarePathFor(path);
  return path;
}

function cloudflarePathFor(path) {
  const roundMatch = path.match(/^\/api\/round\/(\d+)$/);
  if (roundMatch) return `${cloudflareApiBase}/fixtures/round/${roundMatch[1]}`;

  const routes = {
    '/api/standings': '/standings',
    '/api/current-round': '/current-round',
    '/api/season': '/season',
    '/api/news': '/news',
    '/api/tv': '/tv',
    '/api/health': '/health'
  };

  return routes[path] ? `${cloudflareApiBase}${routes[path]}` : path;
}

async function getStaticJson(path) {
  const staticPath = staticPathFor(path);
  if (!staticPath) throw new Error(`No static data fallback for ${path}`);
  const response = await fetch(staticPath, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Static data missing: ${staticPath}`);
  return response.json();
}

function staticPathFor(path) {
  const roundMatch = path.match(/^\/api\/round\/(\d+)$/);
  if (roundMatch) return new URL(`../data/rounds/${roundMatch[1]}.json`, import.meta.url).href;

  const routes = {
    '/api/standings': '../data/standings.json',
    '/api/current-round': '../data/current-round.json',
    '/api/season': '../data/season.json',
    '/api/news': '../data/news.json',
    '/api/tv': '../data/tv.json',
    '/api/health': '../data/health.json'
  };

  return routes[path] ? new URL(routes[path], import.meta.url).href : null;
}

export const api = {
  standings: () => getJson('/api/standings'),
  currentRound: () => getJson('/api/current-round'),
  round: round => getJson(`/api/round/${round}`),
  season: () => getJson('/api/season'),
  tv: () => getJson('/api/tv'),
  news: () => getJson('/api/news'),
  health: () => getJson('/api/health')
};
