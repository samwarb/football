import { api } from './api.js';
import {
  ROUND_COUNT,
  fixtureKey,
  isFixtureToday,
  lastFiveForm,
  outcomeForTeam,
  pointsProgression
} from './normalizers.js';

const state = {
  activeTab: 'table',
  standings: null,
  seasonFixtures: [],
  currentRound: 34,
  minRound: 1,
  maxRound: ROUND_COUNT,
  currentRoundFixtures: [],
  tvLookup: {},
  news: [],
  newsSource: 'all',
  newsQuery: '',
  chart: null,
  statsChart: null,
  lastFocus: null
};

const dom = {
  sourceStrip: document.querySelector('#sourceStrip'),
  tableMount: document.querySelector('#tableMount'),
  tableUpdated: document.querySelector('#tableUpdated'),
  fixturesMount: document.querySelector('#fixturesMount'),
  statsMount: document.querySelector('#statsMount'),
  newsMount: document.querySelector('#newsMount'),
  roundLabel: document.querySelector('#roundLabel'),
  prevRound: document.querySelector('#prevRound'),
  nextRound: document.querySelector('#nextRound'),
  newsSource: document.querySelector('#newsSource'),
  newsSearch: document.querySelector('#newsSearch'),
  modalBackdrop: document.querySelector('#modalBackdrop'),
  modalClose: document.querySelector('#modalClose'),
  modalMount: document.querySelector('#modalMount')
};

function createEl(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function clear(node) {
  node.replaceChildren();
}

function setLoading(node, label) {
  node.replaceChildren(createEl('div', { class: 'loading' }, [
    createEl('span', { class: 'spinner', 'aria-hidden': 'true' }),
    createEl('span', { text: label })
  ]));
}

function setError(node, label, detail = '') {
  node.replaceChildren(createEl('div', { class: 'notice error' }, [
    createEl('strong', { text: label }),
    detail ? createEl('span', { text: detail }) : null
  ]));
}

function dateLabel(date) {
  if (!date) return 'Date TBC';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function fullDateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function sourcePill(label, status = 'ok') {
  return createEl('span', { class: `source-pill ${status}`, text: label });
}

function renderSourceStrip() {
  clear(dom.sourceStrip);
  dom.sourceStrip.append(
    sourcePill(state.standings ? 'Standings synced' : 'Standings pending', state.standings ? 'ok' : 'pending'),
    sourcePill(state.seasonFixtures.length ? 'Form cache ready' : 'Form cache loading', state.seasonFixtures.length ? 'ok' : 'pending'),
    sourcePill(Object.keys(state.tvLookup).length ? 'TV listings cached' : 'TV optional', Object.keys(state.tvLookup).length ? 'ok' : 'warn')
  );
}

function renderTable() {
  if (!state.standings?.teams?.length) {
    setLoading(dom.tableMount, 'Loading standings');
    return;
  }

  const table = createEl('table', { class: 'league-table' });
  const head = createEl('thead');
  head.append(createEl('tr', {}, ['#', 'Club', 'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'Last 5'].map((label, index) =>
    createEl('th', { class: index === 1 ? 'club-col' : '', text: label })
  )));

  const body = createEl('tbody');
  for (const team of state.standings.teams) {
    const row = createEl('tr', {
      tabindex: '0',
      role: 'button',
      'aria-label': `Open ${team.name} details`
    });
    row.addEventListener('click', () => openTeamModal(team.slug));
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openTeamModal(team.slug);
      }
    });

    const form = lastFiveForm(state.seasonFixtures, team.slug);
    const gdText = team.goalDifference > 0 ? `+${team.goalDifference}` : String(team.goalDifference);

    row.append(
      createEl('td', {}, [
        createEl('span', { class: `rank rank-${zoneForRank(team.rank)}`, text: String(team.rank) })
      ]),
      createEl('td', { class: 'club-col' }, [
        createEl('div', { class: 'club-cell' }, [
          team.logo ? createEl('img', { src: team.logo, alt: '', loading: 'lazy' }) : createEl('span', { class: 'badge-fallback', text: team.abbreviation }),
          createEl('span', { text: team.name })
        ])
      ]),
      createEl('td', { text: team.played }),
      createEl('td', { text: team.wins }),
      createEl('td', { text: team.draws }),
      createEl('td', { text: team.losses }),
      createEl('td', { text: team.goalsFor }),
      createEl('td', { text: team.goalsAgainst }),
      createEl('td', { class: team.goalDifference >= 0 ? 'positive' : 'negative', text: gdText }),
      createEl('td', { class: 'points', text: team.points }),
      createEl('td', {}, [renderForm(form)])
    );
    body.append(row);
  }

  table.append(head, body);
  const legend = createEl('div', { class: 'legend' }, [
    legendItem('Champions League', 'cl'),
    legendItem('Europa League', 'el'),
    legendItem('Conference League', 'conf'),
    legendItem('Relegation', 'rel')
  ]);

  dom.tableMount.replaceChildren(createEl('div', { class: 'table-scroll' }, [table]), legend);
  dom.tableUpdated.textContent = `Updated ${new Date(state.standings.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function zoneForRank(rank) {
  if (rank <= 4) return 'cl';
  if (rank <= 6) return 'el';
  if (rank === 7) return 'conf';
  if (rank >= 18) return 'rel';
  return 'mid';
}

function legendItem(label, zone) {
  return createEl('span', { class: 'legend-item' }, [
    createEl('span', { class: `legend-dot ${zone}` }),
    createEl('span', { text: label })
  ]);
}

function renderForm(form) {
  const wrap = createEl('div', { class: 'form-row', 'aria-label': form.length ? `Recent form ${form.join(', ')}` : 'Recent form unavailable' });
  if (!form.length) {
    wrap.append(createEl('span', { class: 'muted', text: 'Pending' }));
    return wrap;
  }
  for (const outcome of form) {
    wrap.append(createEl('span', { class: `form-pill ${outcome.toLowerCase()}`, text: outcome }));
  }
  return wrap;
}

async function loadRound(round) {
  state.currentRound = Math.max(1, Math.min(ROUND_COUNT, round));
  state.currentRound = Math.max(state.minRound, Math.min(state.maxRound, state.currentRound));
  dom.prevRound.disabled = state.currentRound <= state.minRound;
  dom.nextRound.disabled = state.currentRound >= state.maxRound;
  dom.roundLabel.textContent = `Round ${state.currentRound}`;
  setLoading(dom.fixturesMount, 'Loading fixtures');

  try {
    const payload = await api.round(state.currentRound);
    state.currentRoundFixtures = applyTv(payload.fixtures || []);
    renderFixtures();
  } catch (error) {
    setError(dom.fixturesMount, 'Could not load this matchweek', error.message);
  }
}

function applyTv(fixtures) {
  return fixtures.map(fixture => ({
    ...fixture,
    tvChannels: state.tvLookup[fixtureKey(fixture.home.name, fixture.away.name)] || []
  }));
}

function renderFixtures() {
  const fixtures = state.currentRoundFixtures;
  if (!fixtures.length) {
    setError(dom.fixturesMount, `No fixtures found for Round ${state.currentRound}`);
    return;
  }

  const dates = fixtures.map(fixture => fixture.date).filter(Boolean).sort();
  dom.roundLabel.textContent = dates.length
    ? `R${state.currentRound} · ${dateLabel(dates[0])} - ${dateLabel(dates.at(-1))}`
    : `Round ${state.currentRound}`;

  const grid = createEl('div', { class: 'fixture-grid' });
  for (const fixture of fixtures) {
    grid.append(renderFixtureCard(fixture));
  }
  dom.fixturesMount.replaceChildren(grid);
}

function renderFixtureCard(fixture) {
  const score = fixture.played
    ? `${fixture.score.home} - ${fixture.score.away}`
    : fixture.time?.slice(0, 5) || 'vs';
  const status = fixture.live ? 'Live' : fixture.played ? 'FT' : isFixtureToday(fixture) ? 'Today' : 'Scheduled';

  return createEl('article', { class: `fixture-card ${fixture.live ? 'is-live' : ''}` }, [
    createEl('div', { class: 'fixture-meta' }, [
      createEl('span', { text: dateLabel(fixture.date) }),
      fixture.venue ? createEl('span', { text: fixture.venue }) : null,
      createEl('strong', { text: status })
    ]),
    createEl('div', { class: 'fixture-main' }, [
      renderFixtureTeam(fixture.home),
      createEl('div', { class: 'score-box', text: score }),
      renderFixtureTeam(fixture.away)
    ]),
    fixture.tvChannels.length ? createEl('div', { class: 'channel-row' }, fixture.tvChannels.map(channel =>
      createEl('span', { class: 'channel-pill', text: channel })
    )) : null
  ]);
}

function renderFixtureTeam(team) {
  return createEl('div', { class: 'fixture-team' }, [
    team.badge ? createEl('img', { src: team.badge, alt: '', loading: 'lazy' }) : null,
    createEl('span', { text: team.shortName || team.name })
  ]);
}

function renderStats() {
  if (!state.standings?.teams?.length) {
    setLoading(dom.statsMount, 'Loading team stats');
    return;
  }

  const teams = state.standings.teams;
  const panels = [
    ['Most goals', [...teams].sort((a, b) => b.goalsFor - a.goalsFor), 'goalsFor'],
    ['Fewest conceded', [...teams].sort((a, b) => a.goalsAgainst - b.goalsAgainst), 'goalsAgainst'],
    ['Best goal difference', [...teams].sort((a, b) => b.goalDifference - a.goalDifference), 'goalDifference'],
    ['Most wins', [...teams].sort((a, b) => b.wins - a.wins), 'wins']
  ];

  const grid = createEl('div', { class: 'stats-grid' }, panels.map(([title, sorted, key]) =>
    renderStatPanel(title, sorted.slice(0, 10), key)
  ));
  const chartPanel = createEl('div', { class: 'surface chart-panel' }, [
    createEl('h3', { text: 'Goals for and against' }),
    createEl('div', { class: 'chart-wrap' }, [
      createEl('canvas', { id: 'statsChart', 'aria-label': 'Goals for and against chart' })
    ])
  ]);
  dom.statsMount.replaceChildren(grid, chartPanel);
  renderStatsChart();
}

function renderStatPanel(title, teams, key) {
  const max = Math.max(...teams.map(team => Math.abs(team[key])), 1);
  return createEl('section', { class: 'surface stat-panel' }, [
    createEl('h3', { text: title }),
    ...teams.map(team => createEl('div', { class: 'stat-row' }, [
      createEl('span', { text: team.shortName }),
      createEl('span', { class: 'stat-track' }, [
        createEl('span', { class: 'stat-fill', style: `width:${Math.max(4, Math.abs(team[key]) / max * 100)}%` })
      ]),
      createEl('strong', { text: team[key] })
    ]))
  ]);
}

function renderStatsChart() {
  if (!window.Chart) return;
  if (state.statsChart) state.statsChart.destroy();
  const ctx = document.querySelector('#statsChart');
  if (!ctx) return;
  const teams = [...state.standings.teams].sort((a, b) => b.goalsFor - a.goalsFor);
  state.statsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: teams.map(team => team.abbreviation),
      datasets: [
        { label: 'GF', data: teams.map(team => team.goalsFor), backgroundColor: '#1f7a5b' },
        { label: 'GA', data: teams.map(team => team.goalsAgainst), backgroundColor: '#c7553d' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#24352d' } } },
      scales: {
        x: { ticks: { color: '#4d6458' }, grid: { display: false } },
        y: { ticks: { color: '#4d6458' }, grid: { color: '#d8d1bd' } }
      }
    }
  });
}

async function loadNews() {
  setLoading(dom.newsMount, 'Loading news');
  try {
    const payload = await api.news();
    state.news = payload.articles || [];
    renderNews();
  } catch (error) {
    setError(dom.newsMount, 'Could not load news', error.message);
  }
}

function renderNews() {
  const query = state.newsQuery.toLowerCase();
  const articles = state.news.filter(article => {
    const sourceOk = state.newsSource === 'all' || article.source === state.newsSource;
    const text = `${article.headline} ${article.description} ${article.tag} ${(article.teams || []).join(' ')}`.toLowerCase();
    return sourceOk && (!query || text.includes(query));
  });

  if (!articles.length) {
    dom.newsMount.replaceChildren(createEl('div', { class: 'notice' }, [
      createEl('strong', { text: 'No articles match that filter' })
    ]));
    return;
  }

  const list = createEl('div', { class: 'news-list' });
  for (const article of articles) {
    list.append(renderNewsCard(article));
  }
  dom.newsMount.replaceChildren(list);
}

function renderNewsCard(article) {
  return createEl('article', { class: 'news-card' }, [
    article.image ? createEl('img', { src: article.image, alt: '', loading: 'lazy' }) : createEl('div', { class: 'news-image-fallback', text: article.source }),
    createEl('div', { class: 'news-body' }, [
      createEl('div', { class: 'news-meta' }, [
        createEl('span', { class: 'source-chip', text: article.source }),
        createEl('span', { text: fullDateLabel(article.publishedAt) })
      ]),
      createEl('h3', { text: article.headline }),
      article.description ? createEl('p', { text: article.description }) : null,
      createEl('div', { class: 'news-footer' }, [
        createEl('span', { class: 'tag', text: article.tag || 'Premier League' }),
        article.link ? createEl('a', { href: article.link, target: '_blank', rel: 'noopener', text: 'Read story' }) : null
      ])
    ])
  ]);
}

function openTeamModal(slug) {
  const team = state.standings?.teams?.find(item => item.slug === slug);
  if (!team) return;
  state.lastFocus = document.activeElement;
  dom.modalBackdrop.hidden = false;
  document.body.classList.add('modal-open');

  const teamFixtures = state.seasonFixtures
    .filter(fixture => fixture.home.slug === slug || fixture.away.slug === slug)
    .sort((a, b) => {
      const roundDiff = (a.round || 0) - (b.round || 0);
      return roundDiff || a.date.localeCompare(b.date);
    });

  const progression = pointsProgression(teamFixtures, slug);
  const form = lastFiveForm(teamFixtures, slug);

  dom.modalMount.replaceChildren(
    createEl('div', { class: 'modal-head' }, [
      team.logo ? createEl('img', { class: 'modal-logo', src: team.logo, alt: '' }) : null,
      createEl('div', {}, [
        createEl('p', { class: 'section-kicker', text: 'Club dossier' }),
        createEl('h2', { id: 'modalTitle', text: team.name })
      ])
    ]),
    createEl('div', { class: 'kpi-grid' }, [
      kpi('Position', team.rank),
      kpi('Points', team.points),
      kpi('Wins', team.wins),
      kpi('Goals For', team.goalsFor),
      kpi('Goal Diff', team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference)
    ]),
    createEl('section', { class: 'modal-section' }, [
      createEl('div', { class: 'modal-section-head' }, [
        createEl('h3', { text: 'Points progression' }),
        renderForm(form)
      ]),
      progression.length ? createEl('div', { class: 'chart-wrap modal-chart' }, [
        createEl('canvas', { id: 'teamChart', 'aria-label': `${team.name} points progression` })
      ]) : createEl('p', { class: 'muted', text: 'Season history is still loading.' })
    ]),
    createEl('section', { class: 'modal-section' }, [
      createEl('h3', { text: 'Cached fixtures' }),
      renderTeamFixtureList(teamFixtures, slug)
    ])
  );

  dom.modalClose.focus();
  renderTeamChart(team.name, progression);
}

function kpi(label, value) {
  return createEl('div', { class: 'kpi' }, [
    createEl('strong', { text: value }),
    createEl('span', { text: label })
  ]);
}

function renderTeamFixtureList(fixtures, slug) {
  if (!fixtures.length) {
    return createEl('p', { class: 'muted', text: 'No fixtures available yet.' });
  }

  const list = createEl('div', { class: 'team-fixtures' });
  for (const fixture of fixtures) {
    const isHome = fixture.home.slug === slug;
    const opponent = isHome ? fixture.away : fixture.home;
    const outcome = outcomeForTeam(fixture, slug);
    const score = fixture.played
      ? isHome
        ? `${fixture.score.home} - ${fixture.score.away}`
        : `${fixture.score.away} - ${fixture.score.home}`
      : fixture.time?.slice(0, 5) || 'vs';
    list.append(createEl('div', { class: 'team-fixture-row' }, [
      createEl('span', { text: `R${fixture.round || '?'}` }),
      createEl('span', { text: `${isHome ? 'vs' : '@'} ${opponent.name}` }),
      createEl('strong', { text: score }),
      createEl('span', { class: outcome ? `result-badge ${outcome.toLowerCase()}` : 'result-badge pending', text: outcome || 'TBC' })
    ]));
  }
  return list;
}

function renderTeamChart(teamName, progression) {
  if (!window.Chart || !progression.length) return;
  if (state.chart) state.chart.destroy();
  const ctx = document.querySelector('#teamChart');
  if (!ctx) return;
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: progression.map(item => item.label),
      datasets: [{
        label: `${teamName} points`,
        data: progression.map(item => item.points),
        borderColor: '#1f7a5b',
        backgroundColor: 'rgba(31, 122, 91, 0.16)',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#4d6458', maxTicksLimit: 12 }, grid: { display: false } },
        y: { ticks: { color: '#4d6458' }, grid: { color: '#d8d1bd' }, beginAtZero: true }
      }
    }
  });
}

function closeModal() {
  dom.modalBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
  if (state.lastFocus) state.lastFocus.focus();
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.section').forEach(section => {
    section.classList.toggle('active', section.id === `section-${tab}`);
  });

  if (tab === 'fixtures' && !state.currentRoundFixtures.length) loadRound(state.currentRound);
  if (tab === 'stats') renderStats();
  if (tab === 'news' && !state.news.length) loadNews();
}

async function init() {
  wireEvents();
  renderSourceStrip();
  setLoading(dom.tableMount, 'Loading standings');
  setLoading(dom.fixturesMount, 'Loading fixtures');
  setLoading(dom.statsMount, 'Loading stats');

  try {
    const standings = await api.standings();
    state.standings = standings;
    renderTable();
    renderStats();
    renderSourceStrip();
  } catch (error) {
    setError(dom.tableMount, 'Could not load standings', error.message);
  }

  api.tv()
    .then(payload => {
      state.tvLookup = payload.fixtures || {};
      state.currentRoundFixtures = applyTv(state.currentRoundFixtures);
      if (state.activeTab === 'fixtures') renderFixtures();
      renderSourceStrip();
    })
    .catch(() => renderSourceStrip());

  api.season()
    .then(payload => {
      state.seasonFixtures = payload.fixtures || [];
      const rounds = (payload.rounds || []).map(item => item.round).filter(Number.isFinite);
      if (rounds.length) {
        state.minRound = Math.min(...rounds);
        state.maxRound = Math.max(...rounds);
        state.currentRound = Math.max(state.minRound, Math.min(state.maxRound, state.currentRound));
        dom.prevRound.disabled = state.currentRound <= state.minRound;
        dom.nextRound.disabled = state.currentRound >= state.maxRound;
      }
      renderTable();
      if (state.activeTab === 'fixtures') loadRound(state.currentRound);
      if (!state.currentRoundFixtures.length) {
        const current = payload.fixtures?.length ? null : state.currentRound;
        if (current) loadRound(current);
      }
      renderSourceStrip();
    })
    .catch(() => renderSourceStrip());

  try {
    const current = await api.currentRound();
    state.currentRound = current.round || 1;
  } catch {
    state.currentRound = 34;
  }

  loadRound(state.currentRound);
}

function wireEvents() {
  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  dom.prevRound.addEventListener('click', () => loadRound(state.currentRound - 1));
  dom.nextRound.addEventListener('click', () => loadRound(state.currentRound + 1));
  dom.newsSource.addEventListener('change', event => {
    state.newsSource = event.target.value;
    renderNews();
  });
  dom.newsSearch.addEventListener('input', event => {
    state.newsQuery = event.target.value;
    renderNews();
  });
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalBackdrop.addEventListener('click', event => {
    if (event.target === dom.modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dom.modalBackdrop.hidden) closeModal();
    if (event.key === 'Tab' && !dom.modalBackdrop.hidden) trapFocus(event);
  });
}

function trapFocus(event) {
  const focusable = dom.modalBackdrop.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

init();
