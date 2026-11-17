import Link from 'next/link';
import { Suspense } from 'react';
import { CaseKeys } from '@/components/case-keys';
import { LocalTime } from '@/components/local-time';
import { countsText, TallyBar } from '@/components/result-strip';
import { Empty, Loading } from '@/components/states';
import { StatusText } from '@/components/status';
import { caseStats, existingCaseKeys, latestRunsWithFailures, runCounts } from '@/lib/queries';

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1>Overview</h1>
        <p className="mt-1 text-muted">The newest run of every suite, and what is failing in it.</p>
      </div>
      <Suspense fallback={<Loading what="the latest runs" />}>
        <Latest />
      </Suspense>
      <Suspense fallback={<Loading what="test case coverage" rows={1} />}>
        <Coverage />
      </Suspense>
    </div>
  );
}

const firstLine = (s: string | null) => s?.split('\n').find((l) => l.trim())?.trim() ?? '';

async function Latest() {
  const { runs, failures } = await latestRunsWithFailures();
  if (!runs.length) {
    return (
      <Empty>
        <p className="font-medium">No runs yet.</p>
        <p className="mt-1">
          Results appear here after a GitHub Actions workflow uploads them.{' '}
          <Link className="link" href="/setup">
            Add the upload step
          </Link>
        </p>
      </Empty>
    );
  }

  const suiteOf = new Map(runs.map((r) => [r.id, r.suite]));
  const known = await existingCaseKeys([...new Set(failures.flatMap((f) => f.caseKeys))]);

  return (
    <>
      <section aria-label={`Failing now (${failures.length})`}>
        <h2>
          Failing now <span className="font-normal text-muted">({failures.length})</span>
        </h2>
        {failures.length ? (
          <div className="table-frame mt-2">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Case</th>
                  <th scope="col">Test</th>
                  <th scope="col">Browser / device</th>
                  <th scope="col">Suite</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <StatusText status={f.status} />
                    </td>
                    <td>
                      <CaseKeys keys={f.caseKeys} known={known} />
                    </td>
                    <td className="min-w-[280px]">
                      <Link className="link" href={`/runs/${f.runId}?status=failing#result-${f.id}`}>
                        {f.name}
                      </Link>
                      {f.message ? <p className="mono mt-1 line-clamp-2 text-muted">{firstLine(f.message)}</p> : null}
                    </td>
                    <td>{f.variant ?? <span className="text-muted">Not reported</span>}</td>
                    <td className="whitespace-nowrap">{suiteOf.get(f.runId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2">Nothing is failing in the latest run of any suite.</p>
        )}
      </section>

      <section aria-label="Latest run per suite">
        <h2>Latest run per suite</h2>
        <div className="table-frame mt-2">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Suite</th>
                <th scope="col">Started</th>
                <th scope="col">Branch</th>
                <th scope="col" className="w-[40%]">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    <Link className="link" href={`/runs/${r.id}`}>
                      {r.suite}
                    </Link>
                    <span className="text-muted"> · {r.platform}</span>
                  </td>
                  <td>
                    <LocalTime date={r.startedAt} />
                  </td>
                  <td className="mono">{r.branch ?? <span className="font-sans text-muted">Not from CI</span>}</td>
                  <td className="min-w-[220px]">
                    <TallyBar counts={runCounts(r)} />
                    <p className="mt-1">{countsText(runCounts(r))}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function Coverage() {
  const s = await caseStats();
  return (
    <section aria-label="Test cases">
        <h2>Test cases</h2>
      {s.total ? (
        <p className="mt-2">
          {s.total} cases:{' '}
          <Link className="link" href="/cases?automation=automated">
            {s.automated} automated
          </Link>
          ,{' '}
          <Link className="link" href="/cases?automation=manual">
            {s.manual} manual
          </Link>
          ,{' '}
          <Link className="link" href="/cases?automation=planned">
            {s.planned} planned
          </Link>
          .{' '}
          <Link className="link" href="/cases?last=none">
            Cases with no results yet
          </Link>
        </p>
      ) : (
        <Empty>
          <p className="font-medium">No test cases yet.</p>
          <p className="mt-1">
            Results link to cases by the ID at the start of each test title.{' '}
            <Link className="link" href="/cases/import">
              Import the test case sheet
            </Link>
          </p>
        </Empty>
      )}
    </section>
  );
}
