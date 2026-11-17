import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CaseKeys } from '@/components/case-keys';
import { LocalTime } from '@/components/local-time';
import { countsText, TallyBar } from '@/components/result-strip';
import { Empty, Loading } from '@/components/states';
import { STATUS_ORDER, StatusText } from '@/components/status';
import type { Result } from '@/db/schema';
import { existingCaseKeys, getRun, runCounts, runResults } from '@/lib/queries';

export const metadata: Metadata = { title: 'Run' };

const FILTERS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'failing', label: 'Failed and broken', match: (r: Result) => r.status === 'failed' || r.status === 'broken' },
  { value: 'flaky', label: 'Flaky', match: (r: Result) => r.status === 'flaky' },
  { value: 'known-bug', label: 'Known bugs', match: (r: Result) => r.knownBug },
  { value: 'skipped', label: 'Skipped', match: (r: Result) => r.status === 'skipped' },
] as const;

export default function RunPage({ params, searchParams }: PageProps<'/runs/[id]'>) {
  return (
    <Suspense fallback={<Loading what="this run" rows={8} />}>
      <RunDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

async function RunDetail({ params, searchParams }: PageProps<'/runs/[id]'>) {
  const { id } = await params;
  const { status } = await searchParams;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId < 1) notFound();
  const run = await getRun(runId);
  if (!run) notFound();

  const all = await runResults(runId);
  const filter = FILTERS.find((f) => f.value === status) ?? FILTERS[0];
  // Failures first inside each group: they are what the reader came for.
  const rank = (r: Result) => STATUS_ORDER.indexOf(r.status);
  const shown = all.filter(filter.match).sort((a, b) => rank(a) - rank(b));
  const known = await existingCaseKeys([...new Set(all.flatMap((r) => r.caseKeys))]);

  // Grouped the way msl-automation labels them: epic (sheet section), then feature (spec).
  const groups = new Map<string, Result[]>();
  for (const r of shown) {
    const key = [r.epic, r.feature].filter(Boolean).join(' › ') || 'Ungrouped';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted">
          <Link className="link" href="/runs">
            Runs
          </Link>{' '}
          / {run.suite}
        </p>
        <h1 className="mt-1">
          {run.suite} <span className="font-normal text-muted">· {run.platform}</span>
        </h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <dt className="inline text-muted">Started </dt>
            <dd className="inline">
              <LocalTime date={run.startedAt} />
            </dd>
          </div>
          {run.finishedAt ? (
            <div>
              <dt className="inline text-muted">Took </dt>
              <dd className="inline">{formatDuration(run.finishedAt.getTime() - run.startedAt.getTime())}</dd>
            </div>
          ) : null}
          {run.branch ? (
            <div>
              <dt className="inline text-muted">Branch </dt>
              <dd className="mono inline">
                {run.branch}
                {run.commitSha ? ` @ ${run.commitSha.slice(0, 7)}` : ''}
              </dd>
            </div>
          ) : null}
          {run.githubEvent ? (
            <div>
              <dt className="inline text-muted">Trigger </dt>
              <dd className="inline">{run.githubEvent}</dd>
            </div>
          ) : null}
          {run.githubRunUrl ? (
            <div>
              <a className="link" href={run.githubRunUrl} target="_blank" rel="noreferrer">
                Open the workflow run on GitHub
              </a>
            </div>
          ) : null}
        </dl>
        <div className="mt-3 max-w-[640px]">
          <TallyBar counts={runCounts(run)} />
          <p className="mt-1">{countsText(runCounts(run))}</p>
        </div>
      </div>

      <nav aria-label="Filter results" className="flex flex-wrap gap-x-1 border-b border-rule">
        {FILTERS.map((f) => {
          const n = all.filter(f.match).length;
          const current = f.value === filter.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'all' ? `/runs/${run.id}` : `/runs/${run.id}?status=${f.value}`}
              aria-current={current ? 'page' : undefined}
              className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-3 hover:text-ink ${
                current ? 'border-ink font-semibold' : 'border-transparent text-muted'
              }`}
            >
              {f.label} ({n})
            </Link>
          );
        })}
      </nav>

      {!all.length ? (
        <Empty>
          <p>This run was uploaded with no test results in it. Check that the test step wrote its results before the upload.</p>
        </Empty>
      ) : !shown.length ? (
        <p>No results match this filter in this run.</p>
      ) : (
        [...groups].map(([group, rows]) => (
          <section key={group} aria-label={group}>
            <h2>{group}</h2>
            <div className="table-frame mt-2">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Case</th>
                    <th scope="col">Test</th>
                    <th scope="col">Browser / device</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} id={`result-${r.id}`} className="target:bg-paper">
                      <td>
                        <StatusText status={r.status} knownBug={r.knownBug} />
                      </td>
                      <td>
                        <CaseKeys keys={r.caseKeys} known={known} />
                      </td>
                      <td className="min-w-[300px]">
                        {r.name}
                        {r.message || r.trace ? (
                          <details className="mt-1">
                            <summary className="text-muted hover:text-ink">
                              {r.status === 'flaky' ? 'Error on the failed attempt' : 'Error'}
                            </summary>
                            <pre className="mono mt-1 max-h-[360px] overflow-auto whitespace-pre-wrap break-words bg-paper p-2 text-[0.86rem]">
                              {r.trace ?? r.message}
                            </pre>
                          </details>
                        ) : null}
                      </td>
                      <td>{r.variant ?? <span className="text-muted">Not reported</span>}</td>
                      <td>{r.attempts}</td>
                      <td className="whitespace-nowrap">{r.durationMs != null ? formatDuration(r.durationMs) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
