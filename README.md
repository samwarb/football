# Premier League Tracker

A single-file Premier League 2025/26 dashboard. Live standings, fixtures with UK TV channel info, top-scorer stats, and a merged news feed — all in one `.html` file, no build step, no backend.

Open `premier-league-tracker.html` in any modern browser and it just works.

## Features

- **League table** — live standings with European / relegation zone colouring and a form indicator. Click any club for a detail modal (points progression chart, full season results, KPIs).
- **Scheduled fixtures** — round-by-round view with Prev/Next navigation. Live matches auto-refresh every 60 seconds. Each fixture shows which UK channel it's on (Sky Sports, TNT Sports, Amazon Prime, BBC, ITV, Premier League, HBO) with inline SVG brand logos.
- **Stats** — team leaderboards for goals scored, goals conceded, goal difference, and wins, plus a combined GF/GA bar chart.
- **News** — merged feed from ESPN and Sky Sports, newest first, with a source chip on every card. Click to expand, click again to open the full article on the publisher's site.

## Data sources

| Section | Source | Notes |
|---|---|---|
| League table, news (ESPN) | ESPN public JSON API | No key required |
| Fixtures & results | [TheSportsDB](https://www.thesportsdb.com/) | Free tier, key `3` |
| UK TV channels | [live-footballontv.com](https://www.live-footballontv.com/) | Scraped via CORS proxy (`api.codetabs.com`) |
| Sky Sports news | Sky Sports RSS → [rss2json.com](https://rss2json.com) | Free tier; filtered client-side to football only |

All calls are made client-side from the browser.

## Running it

```
open premier-league-tracker.html
```

Or double-click the file. That's it — there's nothing to install, nothing to build.

If you want to host it: copy the file to any static host (GitHub Pages, Netlify, S3, Cloudflare Pages). It's genuinely just one HTML file.

## Known limitations

- **TV channel data only covers the next ~2 weeks.** live-footballontv.com only publishes the current window, so fixtures further out show no broadcaster badge.
- **CORS proxy reliance.** Sky Sports and live-footballontv.com don't send CORS headers. If all the public proxies are rate-limited or down, those features will gracefully degrade (you'll see a warning; the rest of the app keeps working).
- **Free rss2json tier caps Sky articles at 10 per refresh.**
- **Stats tab uses standings data only** — there's no public per-player leader endpoint that doesn't require auth, so it ranks teams rather than individual scorers.

## Tech

Vanilla HTML / CSS / JavaScript. [Chart.js 4](https://www.chartjs.org/) is the only external dependency, loaded from a CDN.

No framework, no bundler, no package.json.

## File layout

```
premier-league-tracker.html    # the whole app
README.md                      # this file
```
