# Matchday Ledger

A maintainable Premier League 2025/26 dashboard with a small local data service, normalized provider data, cached API responses, fixtures/results, real last-five form, team stats, club dossiers, TV listings, and a merged news feed.

The original single-file prototype is still available as `premier-league-tracker.html`. The bundled visual experiment that used to be `index.html` has been preserved at `legacy/matchday-ledger-bundle.html`.

## Features

- **Standings** — live ESPN table data normalized into a stable club model, with sticky mobile-friendly club column and real last-five form once the current form cache is ready.
- **Fixtures & Results** — round-by-round TheSportsDB fixtures, date-driven current round detection, TV badges when the server-side TV parser can match listings, and clear finished/live/scheduled states.
- **Team Stats** — honest team leaderboards for goals scored, goals conceded, goal difference, and wins, plus a GF/GA chart.
- **News** — server-fetched ESPN and Sky Sports feed with source filtering, search, sanitized text rendering, and outbound article links.
- **Club dossiers** — accessible modal with focus handling, KPIs, points progression, recent form, and cached fixtures.

## Data sources

| Section | Source | Notes |
|---|---|---|
| League table, news (ESPN) | ESPN public JSON API | No key required |
| Fixtures & results | [TheSportsDB](https://www.thesportsdb.com/) | Free tier, key `3` |
| UK TV channels | [live-footballontv.com](https://www.live-footballontv.com/) | Parsed server-side and cached; no public browser CORS proxy |
| Sky Sports news | Sky Sports RSS → [rss2json.com](https://rss2json.com) | Fetched server-side and filtered to football |

Provider calls now run through the local server so the browser talks to same-origin `/api/*` endpoints. Responses are normalized, cached, and served stale when a provider has a temporary failure.

## Running it

```
npm start
```

Then open http://localhost:4173.

There is no build step and no external npm dependency. Node 18+ is required for native `fetch`.

Run the normalization tests with:

```
npm test
```

## iOS / Xcode

The repo now includes a native SwiftUI app wrapper in `ios/MatchdayLedger.xcodeproj`. It uses `WKWebView` to load the football experience inside an iPhone app shell.

Open the project in Xcode 15+ and run the `MatchdayLedger` scheme. By default the app loads the live GitHub Pages site at `https://samwarb.github.io/football/`.

For local development, start the web app first:

```
npm start
```

Then in Xcode, add a launch argument:

```
--url
http://localhost:4173
```

That makes the iOS app point at your local server instead of the hosted site.

## Cloudflare API

The repo includes a Cloudflare Worker API in `worker/index.js`. This is the scalable backend path for public web and iOS clients, so GitHub remains source control rather than the production data host.

Run the Worker API smoke test locally with:

```
npm run worker:smoke
```

Check that Wrangler can bundle the Worker with:

```
npm run worker:deploy -- --dry-run
```

Before deploying to Cloudflare for real, authenticate Wrangler:

```
npx wrangler login
```

Then create a KV namespace for persistent cached football data:

```
npm run worker:kv:create
```

Copy the returned namespace id into `wrangler.toml` by uncommenting the `[[kv_namespaces]]` block and replacing `replace_with_cloudflare_kv_namespace_id`. Then deploy to a temporary `workers.dev` URL:

```
npm run worker:deploy
```

The Worker exposes:

```
/v1/standings
/v1/current-round
/v1/fixtures/current
/v1/fixtures/round/:round
/v1/season
/v1/news
/v1/tv
/v1/health
```

It also keeps the old `/api/*` routes working while the web and iOS clients migrate.

## Publishing to GitHub Pages

This app can run on GitHub Pages even though the development version has a local API. The `build` command exports the app and a static JSON data snapshot into `dist/`.

```
npm run build
```

The included GitHub Actions workflow at `.github/workflows/deploy-pages.yml` builds and deploys `dist/` to GitHub Pages on every push to `main`, on manual dispatch, and every six hours. In the repository settings, **Pages → Build and deployment → Source → GitHub Actions** is the preferred setup.

Because GitHub Pages cannot run a server, the hosted app reads from generated files in `data/` instead of `/api/*`. The repository also keeps a root `data/` snapshot so branch-based Pages works immediately; scheduled workflow runs refresh it.

## Known limitations

- **TV channel data only covers the published TV window.** Future fixtures with no confirmed broadcaster show no badge.
- **Free provider limits still apply.** The local service caches and degrades gracefully, but it cannot invent missing upstream data. To avoid TheSportsDB rate limits, the form cache fetches a current-round window rather than all 38 rounds at once.
- **Stats are team stats.** Player leaderboards need a licensed player/stat provider.

## Tech

Vanilla HTML / CSS / JavaScript with a tiny Node server. [Chart.js 4](https://www.chartjs.org/) is loaded from a CDN for charts.

## File layout

```
.github/workflows/deploy-pages.yml # GitHub Pages deployment workflow
scripts/build-pages.js             # static exporter for Pages
data/                              # generated static data for branch-based Pages
index.html                         # current app shell
server/index.js                    # local API, cache, provider adapters
src/api.js                         # browser API client
src/main.js                        # modular browser app
src/normalizers.js                 # shared provider normalization helpers
src/teamIdentity.js                # canonical club identity and aliases
src/styles.css                     # app styling
tests/normalizers.test.js          # normalization/unit tests
ios/MatchdayLedger.xcodeproj       # Xcode project for the iOS wrapper
ios/MatchdayLedger/*.swift         # SwiftUI shell and WebKit bridge
worker/index.js                    # Cloudflare Worker API
wrangler.toml                      # Cloudflare deployment config
premier-league-tracker.html        # legacy single-file prototype
legacy/matchday-ledger-bundle.html # preserved generated bundle
README.md
```
