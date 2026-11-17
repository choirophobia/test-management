import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FilterForm } from '@/components/filter-form';
import { LocalTime } from '@/components/local-time';
import { countsText, TallyBar } from '@/components/result-strip';
import { Empty, Loading } from '@/components/states';
import { listRuns, listSuites, runCounts } from '@/lib/queries';

export const metadata: Metadata = { title: 'Runs' };

export default function RunsPage({ searchParams }: PageProps<'/runs'>) {
  return (
    <div className="space-y-4">
      <div>
        <h1>Runs</h1>
        <p className="mt-1 text-muted">Every uploaded run, newest first (last 100).</p>
      </div>
      <Suspense fallback={<Loading what="runs" />}>
        <RunsTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RunsTable({ searchParams }: { searchParams: PageProps<'/runs'>['searchParams'] }) {
  const { suite } = await searchParams;
  const selected = typeof suite === 'string' && suite ? suite : undefined;
  const [suites, runs] = await Promise.all([listSuites(), listRuns(selected)]);

  if (!suites.length) {
    return (
      <Empty>
        <p className="font-medium">No runs uploaded yet.</p>
        <p className="mt-1">
          Add the upload step to the workflow that runs your tests, then start it once.{' '}
          <Link className="link" href="/setup">
            Setup instructions
          </Link>
        </p>
      </Empty>
    );
  }

  return (
    <>
      <FilterForm key={selected ?? ''} className="flex flex-wrap items-end gap-2" action="/runs">
        <label className="block">
          <span className="label">Suite</span>
          <select name="suite" className="field w-auto" defaultValue={selected ?? ''}>
            <option value="">All suites</option>
            {suites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn">
          Show runs
        </button>
      </FilterForm>

      <div className="table-frame">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Started</th>
              <th scope="col">Suite</th>
              <th scope="col">Branch and commit</th>
              <th scope="col">Trigger</th>
              <th scope="col" className="w-[34%]">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="link" href={`/runs/${r.id}`}>
                    <LocalTime date={r.startedAt} />
                  </Link>
                </td>
                <td className="whitespace-nowrap">
                  {r.suite} <span className="text-muted">· {r.platform}</span>
                </td>
                <td className="mono whitespace-nowrap">
                  {r.branch ?? <span className="font-sans text-muted">Not from CI</span>}
                  {r.commitSha ? <span className="text-muted"> @ {r.commitSha.slice(0, 7)}</span> : null}
                </td>
                <td>{r.githubEvent ?? <span className="text-muted">Not from CI</span>}</td>
                <td className="min-w-[220px]">
                  <TallyBar counts={runCounts(r)} />
                  <p className="mt-1">{countsText(runCounts(r))}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
