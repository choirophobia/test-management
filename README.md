# MSL Test Hub

One web app for MyStudyLife testing: the test case repository, automated run results from
GitHub Actions, and (next) manual runs, PDF reports and performance results.

- **Test cases:** import the existing sheet (.xlsx or .csv), then edit cases here. Each case keeps its sheet ID (`AUTH-001`).
- **Runs:** a step at the end of each GitHub Actions workflow uploads its results. Retries show as *flaky*, `[known bug]` tests as known bugs.
- **Linking:** a test whose title starts with a case ID (`RESET-006 / ON-04 ...`) appears on that case's page, across every run and browser.
- **Sign-in:** email links, no passwords. Only addresses or domains in `ALLOWED_EMAILS` can sign in.

## Run it locally

Needs Node 22 and Postgres 16 (local, Docker or Supabase).

```bash
npm install
cp .env.example .env          # set DATABASE_URL and INGEST_TOKEN (openssl rand -hex 32)
cp .env .env.local
npm run db:migrate            # creates the tables
npm run dev                   # http://localhost:3000
```

Put your own address in `ALLOWED_EMAILS`, open the app and ask for a link. Without `SMTP_URL`,
the link is printed in the terminal running `npm run dev`.

## Sign-in

- Enter an email on `/login`; an allowed address gets a link that works **once, for 15 minutes**.
- Opening the link shows a **Sign in** button; signing in happens on the click, so mail scanners
  that open links do not use them up.
- Everyone sees the same "check your email" message, so the page never reveals which addresses are allowed.
- At most 5 links per address per 15 minutes. Sessions last 30 days; **Sign out** ends the session on the server.
- Tokens and sessions are stored only as SHA-256 hashes. Links are built from `APP_URL`, never from the request's Host header.

| Variable | Example |
|---|---|
| `ALLOWED_EMAILS` | `fikri@example.com, @mystudylife.com` (an address or a whole domain) |
| `APP_URL` | `https://test-hub.example.com` |
| `SMTP_URL` | Gmail: `smtps://you%40gmail.com:<app password>@smtp.gmail.com:465` |
| `MAIL_FROM` | `MSL Test Hub <you@gmail.com>` |

For Gmail, create an app password (Google Account, Security, 2-Step Verification, App passwords)
and put it in `SMTP_URL`, with the `@` of your address written as `%40`.

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
3. Vercel: import this repository, set `DATABASE_URL`, `INGEST_TOKEN`, `ALLOWED_EMAILS`, `APP_URL`
   (the Vercel address), `SMTP_URL` and `MAIL_FROM`, then deploy.

## Checks

```bash
npm run typecheck && npm run lint
npm test            # unit: Allure/JUnit parsing, sheet import, sign-in rules
npm run test:e2e    # click-through of the built app, sign-in included, against a separate database (hub_e2e)
```

`npm run test:e2e` builds the app and runs it on port 3100 against `E2E_DATABASE_URL`
(default `postgres://hub:hub@localhost:5432/hub_e2e`), which it empties first. It uses the
installed Google Chrome.

## How it is built

Next.js 16 (App Router, Cache Components), Postgres with Drizzle, Tailwind 4. Design direction is in
`DESIGN.md`; UI work is filtered through the antislop rules in `.claude/skills/` (see `AGENTS.md`).

## Next slices

1. Manual test runs: pick cases, record pass/fail with notes, same result strip as automation.
2. PDF report of a run or a release, generated here instead of by hand.
3. Performance: k6 `handleSummary` upload into the reserved `perf_metrics` table, with p95 trends.
