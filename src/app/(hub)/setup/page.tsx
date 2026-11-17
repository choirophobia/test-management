import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Setup' };

function Code({ children }: { children: string }) {
  return <pre className="mono mt-2 overflow-x-auto border border-rule bg-surface p-3 text-[0.86rem] leading-relaxed">{children}</pre>;
}

const webStep = `      # In .github/workflows/web-e2e.yml, job "report", right after "Collect every browser's results":
      - name: Send the results to MSL Test Hub
        if: always()
        continue-on-error: true # a hub outage must never fail the test run
        env:
          HUB_URL: \${{ vars.HUB_URL }}
          HUB_INGEST_TOKEN: \${{ secrets.HUB_INGEST_TOKEN }}
        run: node scripts/hub-upload.mjs --suite "Web E2E (Dev)" --platform web --format allure --dir allure-results`;

const wdioReporter = `// mobile/wdio.conf.ts (after: npm i -D @wdio/junit-reporter --workspace mobile)
reporters: ['spec', ['junit', { outputDir: './junit-results' }]],`;

const iosStep = `      # In .github/workflows/mobile-ios-e2e.yml, after the test step:
      - name: Send the results to MSL Test Hub
        if: always()
        continue-on-error: true
        working-directory: mobile
        env:
          HUB_URL: \${{ vars.HUB_URL }}
          HUB_INGEST_TOKEN: \${{ secrets.HUB_INGEST_TOKEN }}
        run: node ../web/scripts/hub-upload.mjs --suite "iOS E2E (Dev)" --platform ios --format junit --dir junit-results`;

export default function SetupPage() {
  return (
    <div className="max-w-[860px] space-y-8">
      <div>
        <h1>Setup</h1>
        <p className="mt-1">
          How results get here: a step at the end of each GitHub Actions workflow sends its result files to this hub. Test titles
          that start with a case ID (<span className="mono">AUTH-001</span>, <span className="mono">RESET-006 / ON-04</span>) link
          to that case automatically.
        </p>
      </div>

      <section className="space-y-2" aria-label="Once per repository">
        <h2>Once per repository</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            Copy <span className="mono">tools/hub-upload.mjs</span> from this repository to{' '}
            <span className="mono">web/scripts/hub-upload.mjs</span> in msl-automation. It has no dependencies.
          </li>
          <li>
            In msl-automation, Settings, Secrets and variables, Actions: add the variable{' '}
            <span className="mono">HUB_URL</span> with this address:
            <Suspense fallback={<Code>Reading this site&apos;s address…</Code>}>
              <HubUrl />
            </Suspense>
          </li>
          <li>
            Add the secret <span className="mono">HUB_INGEST_TOKEN</span> with the same value as{' '}
            <span className="mono">INGEST_TOKEN</span> in this hub&apos;s environment. Ask whoever deployed the hub; it is never
            shown here.
          </li>
        </ol>
      </section>

      <section aria-label="Web E2E (Allure results)">
        <h2>Web E2E (Allure results)</h2>
        <p className="mt-1">
          The report job already merges every browser&apos;s <span className="mono">allure-results</span>. Upload that merged
          folder once, so a run with 9 shards arrives as one run. Retries become <em>flaky</em>, and{' '}
          <span className="mono">[known bug]</span> tests are marked as known bugs.
        </p>
        <Code>{webStep}</Code>
      </section>

      <section aria-label="iOS E2E (JUnit XML)">
        <h2>iOS E2E (JUnit XML)</h2>
        <p className="mt-1">The mobile suite only prints to the console today. Add a JUnit reporter so it writes result files:</p>
        <Code>{wdioReporter}</Code>
        <p className="mt-3">Then upload them from the iOS workflow:</p>
        <Code>{iosStep}</Code>
      </section>

      <section aria-label="From your machine">
        <h2>From your machine</h2>
        <p className="mt-1">The same script works locally after a run. Without GitHub variables it is saved as a run with no branch.</p>
        <Code>{`cd web
HUB_URL=<hub address> HUB_INGEST_TOKEN=<token> node scripts/hub-upload.mjs --suite "Web E2E (local)" --dir allure-results`}</Code>
      </section>

      <p>
        After the first upload, the run shows up under{' '}
        <Link className="link" href="/runs">
          Runs
        </Link>
        .
      </p>
    </div>
  );
}

async function HubUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return <Code>{`${proto}://${host}`}</Code>;
}
