export const PREMIER_LEAGUE_TEAMS = [
  { slug: 'arsenal', displayName: 'Arsenal', shortName: 'Arsenal', aliases: ['Arsenal FC'] },
  { slug: 'aston-villa', displayName: 'Aston Villa', shortName: 'Aston Villa', aliases: ['Aston Villa FC'] },
  { slug: 'bournemouth', displayName: 'Bournemouth', shortName: 'Bournemouth', aliases: ['AFC Bournemouth'] },
  { slug: 'brentford', displayName: 'Brentford', shortName: 'Brentford', aliases: ['Brentford FC'] },
  { slug: 'brighton', displayName: 'Brighton and Hove Albion', shortName: 'Brighton', aliases: ['Brighton & Hove Albion', 'Brighton'] },
  { slug: 'burnley', displayName: 'Burnley', shortName: 'Burnley', aliases: ['Burnley FC'] },
  { slug: 'chelsea', displayName: 'Chelsea', shortName: 'Chelsea', aliases: ['Chelsea FC'] },
  { slug: 'crystal-palace', displayName: 'Crystal Palace', shortName: 'Crystal Palace', aliases: ['Crystal Palace FC'] },
  { slug: 'everton', displayName: 'Everton', shortName: 'Everton', aliases: ['Everton FC'] },
  { slug: 'fulham', displayName: 'Fulham', shortName: 'Fulham', aliases: ['Fulham FC'] },
  { slug: 'leeds-united', displayName: 'Leeds United', shortName: 'Leeds', aliases: ['Leeds', 'Leeds United FC'] },
  { slug: 'liverpool', displayName: 'Liverpool', shortName: 'Liverpool', aliases: ['Liverpool FC'] },
  { slug: 'manchester-city', displayName: 'Manchester City', shortName: 'Man City', aliases: ['Man City', 'Manchester City FC'] },
  { slug: 'manchester-united', displayName: 'Manchester United', shortName: 'Man United', aliases: ['Man United', 'Man Utd', 'Manchester United FC'] },
  { slug: 'newcastle-united', displayName: 'Newcastle United', shortName: 'Newcastle', aliases: ['Newcastle', 'Newcastle United FC'] },
  { slug: 'nottingham-forest', displayName: 'Nottingham Forest', shortName: 'Nottingham Forest', aliases: ['Nottm Forest', 'Nottingham Forest FC'] },
  { slug: 'sunderland', displayName: 'Sunderland', shortName: 'Sunderland', aliases: ['Sunderland AFC'] },
  { slug: 'tottenham-hotspur', displayName: 'Tottenham Hotspur', shortName: 'Tottenham', aliases: ['Tottenham', 'Spurs', 'Tottenham Hotspur FC'] },
  { slug: 'west-ham-united', displayName: 'West Ham United', shortName: 'West Ham', aliases: ['West Ham', 'West Ham United FC'] },
  { slug: 'wolverhampton-wanderers', displayName: 'Wolverhampton Wanderers', shortName: 'Wolves', aliases: ['Wolves', 'Wolverhampton', 'Wolverhampton Wanderers FC'] }
];

export function normalizeTeamName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\bfootball club\b/g, '')
    .replace(/\bafc\b/g, '')
    .replace(/\bfc\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const teamIndex = new Map();

for (const team of PREMIER_LEAGUE_TEAMS) {
  const names = [team.displayName, team.shortName, team.slug, ...team.aliases];
  for (const name of names) {
    teamIndex.set(normalizeTeamName(name), team);
  }
}

export function canonicalTeam(input = '') {
  const normalized = normalizeTeamName(input);
  if (teamIndex.has(normalized)) return teamIndex.get(normalized);

  for (const [key, team] of teamIndex) {
    const keyTokens = key.split(' ').filter(Boolean);
    const inputTokens = normalized.split(' ').filter(Boolean);
    const overlap = keyTokens.filter(token => inputTokens.includes(token));
    if (overlap.length >= Math.min(2, keyTokens.length)) return team;
  }

  return {
    slug: normalized.replace(/\s+/g, '-') || 'unknown',
    displayName: input || 'Unknown',
    shortName: input || 'Unknown',
    aliases: []
  };
}
