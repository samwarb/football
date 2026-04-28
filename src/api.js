const localApiHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const hasLocalApi = localApiHosts.has(window.location.hostname);

export async function getJson(path) {
  if (!hasLocalApi && path.startsWith('/api/')) {
    return getStaticJson(path);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(path, { signal: controller.signal });
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
