import worker from '../worker/index.js';

class MemoryKV {
  constructor() {
    this.store = new Map();
  }

  async get(key, type) {
    const value = this.store.get(key);
    if (value === undefined) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      keys: [...this.store.keys()]
        .filter(key => key.startsWith(prefix))
        .map(name => ({ name }))
    };
  }
}

const env = {
  API_VERSION: 'v1',
  FOOTBALL_CACHE: new MemoryKV()
};

const waitUntilTasks = [];
const ctx = {
  waitUntil(task) {
    waitUntilTasks.push(Promise.resolve(task));
  }
};

async function request(path) {
  const response = await worker.fetch(new Request(`https://local.matchday-ledger.test${path}`), env, ctx);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const health = await request('/v1/health');
  assert(health.ok, 'health should be ok');

  const standings = await request('/v1/standings');
  assert(Array.isArray(standings.teams) && standings.teams.length >= 20, 'standings should include teams');

  const currentRound = await request('/v1/current-round');
  assert(Number.isFinite(currentRound.round), 'current round should be numeric');

  const fixtures = await request('/v1/fixtures/current');
  assert(Array.isArray(fixtures.fixtures), 'current fixtures should include fixture list');

  const news = await request('/v1/news');
  assert(Array.isArray(news.articles), 'news should include articles');

  const legacy = await request('/api/standings');
  assert(Array.isArray(legacy.teams) && legacy.teams.length === standings.teams.length, 'legacy /api route should work');

  await Promise.all(waitUntilTasks);
  console.log(`Worker smoke passed: ${standings.teams.length} teams, round ${currentRound.round}, ${news.articles.length} articles`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
