import { canonicalTeam, normalizeTeamName } from './teamIdentity.js';

export const SPORTSDB_LEAGUE = 4328;
export const SEASON = '2025-2026';
export const ROUND_COUNT = 38;

export function asText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).replace(/\s+/g, ' ').trim();
}

export function decodeEntities(value = '') {
  return asText(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
}

export function stripHtml(value = '') {
  return decodeEntities(String(value).replace(/<[^>]*>/g, ' '));
}

export function getStandingEntries(raw) {
  return raw?.children?.[0]?.standings?.entries || [];
}

export function statValue(entry, names, fallback = 0) {
  const wanted = Array.isArray(names) ? names : [names];
  const stat = entry?.stats?.find(item =>
    wanted.includes(item.name) || wanted.includes(item.abbreviation)
  );
  const value = Number.parseFloat(stat?.value);
  return Number.isFinite(value) ? value : fallback;
}

export function normalizeStandings(raw) {
  const entries = getStandingEntries(raw)
    .map((entry, index) => {
      const rawTeam = entry.team || {};
      const identity = canonicalTeam(rawTeam.displayName || rawTeam.name || rawTeam.shortDisplayName);
      const goalsFor = statValue(entry, ['pointsFor', 'GF']);
      const goalsAgainst = statValue(entry, ['pointsAgainst', 'GA']);
      const goalDifference = statValue(entry, ['pointDifferential', 'GD'], goalsFor - goalsAgainst);
      const wins = statValue(entry, ['wins', 'W']);
      const draws = statValue(entry, ['ties', 'D']);
      const losses = statValue(entry, ['losses', 'L']);

      return {
        providerId: asText(rawTeam.id),
        slug: identity.slug,
        name: identity.displayName,
        shortName: identity.shortName,
        abbreviation: asText(rawTeam.abbreviation, identity.shortName.slice(0, 3).toUpperCase()),
        logo: rawTeam.logos?.[0]?.href || '',
        rank: statValue(entry, ['rank'], index + 1),
        played: statValue(entry, ['gamesPlayed', 'GP'], wins + draws + losses),
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference,
        points: statValue(entry, ['points', 'PTS']),
        note: asText(entry.note?.description)
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return {
    season: SEASON,
    updatedAt: new Date().toISOString(),
    teams: entries
  };
}

export function normalizeFixture(raw) {
  const home = canonicalTeam(raw?.strHomeTeam);
  const away = canonicalTeam(raw?.strAwayTeam);
  const homeScore = parseScore(raw?.intHomeScore);
  const awayScore = parseScore(raw?.intAwayScore);
  const status = asText(raw?.strStatus || raw?.strResult || raw?.strProgress, homeScore === null ? 'Scheduled' : 'FT');
  const played = homeScore !== null && awayScore !== null;
  const live = ['1H', '2H', 'HT', 'ET', 'PEN', 'LIVE'].includes(status.toUpperCase());

  return {
    id: asText(raw?.idEvent, `${raw?.intRound || '?'}-${home.slug}-${away.slug}`),
    round: Number.parseInt(raw?.intRound, 10) || null,
    date: asText(raw?.dateEvent),
    time: asText(raw?.strTimeLocal || raw?.strTime),
    venue: asText(raw?.strVenue),
    status,
    played,
    live,
    home: {
      slug: home.slug,
      name: home.displayName,
      shortName: home.shortName,
      badge: raw?.strHomeTeamBadge || ''
    },
    away: {
      slug: away.slug,
      name: away.displayName,
      shortName: away.shortName,
      badge: raw?.strAwayTeamBadge || ''
    },
    score: {
      home: homeScore,
      away: awayScore
    },
    tvChannels: []
  };
}

export function parseScore(value) {
  if (value === null || value === undefined || value === '' || value === 'null') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fixtureKey(homeName, awayName) {
  return `${normalizeTeamName(homeName)}|${normalizeTeamName(awayName)}`;
}

export function isFixtureToday(fixture, now = new Date()) {
  if (!fixture?.date) return false;
  return fixture.date === now.toISOString().slice(0, 10);
}

export function outcomeForTeam(fixture, slug) {
  const isHome = fixture.home.slug === slug;
  const isAway = fixture.away.slug === slug;
  if (!fixture.played || (!isHome && !isAway)) return null;
  const mine = isHome ? fixture.score.home : fixture.score.away;
  const theirs = isHome ? fixture.score.away : fixture.score.home;
  if (mine > theirs) return 'W';
  if (mine < theirs) return 'L';
  return 'D';
}

export function pointsForOutcome(outcome) {
  if (outcome === 'W') return 3;
  if (outcome === 'D') return 1;
  return 0;
}

export function lastFiveForm(fixtures, slug) {
  return fixtures
    .filter(fixture => fixture.played && (fixture.home.slug === slug || fixture.away.slug === slug))
    .sort((a, b) => `${b.date}-${b.round || 0}`.localeCompare(`${a.date}-${a.round || 0}`))
    .slice(0, 5)
    .map(fixture => outcomeForTeam(fixture, slug))
    .filter(Boolean);
}

export function pointsProgression(fixtures, slug) {
  let points = 0;
  return fixtures
    .filter(fixture => fixture.played && (fixture.home.slug === slug || fixture.away.slug === slug))
    .sort((a, b) => {
      const roundDiff = (a.round || 0) - (b.round || 0);
      return roundDiff || a.date.localeCompare(b.date);
    })
    .map(fixture => {
      const outcome = outcomeForTeam(fixture, slug);
      points += pointsForOutcome(outcome);
      return {
        round: fixture.round,
        label: `R${fixture.round || '?'}`,
        points
      };
    });
}

export function selectCurrentRound(fixtures, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const byRound = new Map();

  for (const fixture of fixtures) {
    if (!fixture.round || !fixture.date) continue;
    if (!byRound.has(fixture.round)) byRound.set(fixture.round, []);
    byRound.get(fixture.round).push(fixture);
  }

  const summaries = [...byRound.entries()]
    .map(([round, roundFixtures]) => {
      const dates = roundFixtures.map(fixture => fixture.date).sort();
      return {
        round,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
        hasLive: roundFixtures.some(fixture => fixture.live),
        hasToday: roundFixtures.some(fixture => fixture.date === today),
        hasPlayed: roundFixtures.some(fixture => fixture.played)
      };
    })
    .sort((a, b) => a.round - b.round);

  const liveRound = summaries.find(summary => summary.hasLive || summary.hasToday);
  if (liveRound) return liveRound.round;

  const mostRecent = summaries
    .filter(summary => summary.firstDate <= today || summary.hasPlayed)
    .at(-1);
  if (mostRecent) return mostRecent.round;

  return summaries[0]?.round || 1;
}
