# MSL Test Hub

One web app for MyStudyLife testing: the test case repository, automated run results from
GitHub Actions, and (next) manual runs, PDF reports and performance results.

- **Test cases:** import the existing sheet (.xlsx or .csv), then edit cases here. Each case keeps its sheet ID (`AUTH-001`).
- **Runs:** a step at the end of each GitHub Actions workflow uploads its results. Retries show as *flaky*, `[known bug]` tests as known bugs.
- **Linking:** a test whose title starts with a case ID (`RESET-006 / ON-04 ...`) appears on that case's page, across every run and browser.

> **No sign-in yet.** Anyone who can open the URL can read and edit. Run it locally or behind a private network until auth lands (next slice).

## Run it locally

Needs Node 22 and Postgres 16 (local, Docker or Supabase).

```bash
npm install
cp .env.example .env          # set DATABASE_URL and INGEST_TOKEN (openssl rand -hex 32)
cp .env .env.local
npm run db:migrate            # creates the tables
npm run dev                   # http://localhost:3000
```

Load the sample results to see it working:

```bash
HUB_URL=http://localhost:3000 HUB_INGEST_TOKEN=<your token> \
  node tools/hub-upload.mjs --suite "Web E2E (sample)" --dir <folder with *-result.json>
```

## Send results from GitHub Actions

Full steps, with the exact YAML for `msl-automation`, are on the app's **Setup** page. In short:

1. Copy `tools/hub-upload.mjs` (no dependencies) into the test repository.
2. Add the variable `HUB_URL` and the secret `HUB_INGEST_TOKEN` (same value as `INGEST_TOKEN` here).
3. Add one step after the tests:

```yaml
- name: Send the results to MSL Test Hub
  if: always()
  continue-on-error: true
  env:
    HUB_URL: ${{ vars.HUB_URL }}
    HUB_INGEST_TOKEN: ${{ secrets.HUB_INGEST_TOKEN }}
  run: node scripts/hub-upload.mjs --suite "Web E2E (Dev)" --platform web --format allure --dir allure-results
```

Re-running the same workflow attempt replaces that run instead of adding a copy.

### Ingest API

`POST /api/ingest` with `Authorization: Bearer <INGEST_TOKEN>`:

| Field | Value |
|---|---|
| `suite` | Workflow name, e.g. `Web E2E (Dev)` |
| `platform` | `web`, `ios`, `android` or `api` |
| `format` | `allure` (with `results`: array of Allure `*-result.json` objects) or `junit` (with `junit`: array of XML strings) |
| `github` | optional: `runId`, `runAttempt`, `runUrl`, `sha`, `branch`, `event` |

Returns `201` with the run's counts, its URL, and `unknownCaseKeys`: IDs found in test titles that have no case here yet.

## Deploy (Vercel + Supabase)

1. Supabase: create a project, copy the pooled connection string (Project Settings, Database).
2. Run `DATABASE_URL=<that string> npm run db:migrate` once from your machine.
3. Vercel: import this repository, set `DATABASE_URL` and `INGEST_TOKEN`, deploy.

## Checks

```bash
npm run typecheck && npm run lint
npm test            # unit: Allure/JUnit parsing and sheet import, against real Playwright output
npm run test:e2e    # click-through of the built app against a separate database (hub_e2e)
```

`npm run test:e2e` builds the app and runs it on port 3100 against `E2E_DATABASE_URL`
(default `postgres://hub:hub@localhost:5432/hub_e2e`), which it empties first. It uses the
installed Google Chrome.

## How it is built

Next.js 16 (App Router, Cache Components), Postgres with Drizzle, Tailwind 4. Design direction is in
`DESIGN.md`; UI work is filtered through the antislop rules in `.claude/skills/` (see `AGENTS.md`).

## Next slices

1. Sign-in (Supabase Auth, MyStudyLife Google accounts only).
2. Manual test runs: pick cases, record pass/fail with notes, same result strip as automation.
3. PDF report of a run or a release, generated here instead of by hand.
4. Performance: k6 `handleSummary` upload into the reserved `perf_metrics` table, with p95 trends.
