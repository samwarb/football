import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  estimateCurrentRound,
  getNews,
  getRound,
  getSeason,
  getStandings,
  getTvListings
} from '../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const dataDir = path.join(distDir, 'data');

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(dataDir, { recursive: true });

  await copyFile('index.html');
  await copyDir('src');
  await fs.writeFile(path.join(distDir, '.nojekyll'), '');

  const [standings, currentRoundPayload, season, tv, news] = await Promise.all([
    getStandings(),
    estimateCurrentRound().then(round => ({ season: '2025-2026', round })),
    getSeason(),
    getTvListings(),
    getNews()
  ]);

  const rounds = (season.rounds || [])
    .map(item => item.round)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  await writeJson('standings.json', standings);
  await writeJson('current-round.json', currentRoundPayload);
  await writeJson('season.json', season);
  await writeJson('tv.json', tv);
  await writeJson('news.json', news);
  await writeJson('health.json', {
    ok: true,
    static: true,
    generatedAt: new Date().toISOString(),
    rounds
  });

  await fs.mkdir(path.join(dataDir, 'rounds'), { recursive: true });
  for (const round of rounds) {
    const payload = await getRound(round);
    await writeJson(path.join('rounds', `${round}.json`), payload);
  }

  console.log(`Built GitHub Pages artifact in ${distDir}`);
  console.log(`Included rounds: ${rounds.join(', ') || 'none'}`);
}

async function copyFile(relativePath) {
  await fs.copyFile(path.join(rootDir, relativePath), path.join(distDir, relativePath));
}

async function copyDir(relativePath) {
  await fs.cp(path.join(rootDir, relativePath), path.join(distDir, relativePath), {
    recursive: true
  });
}

async function writeJson(relativePath, payload) {
  const target = path.join(dataDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
