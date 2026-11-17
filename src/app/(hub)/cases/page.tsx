import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FilterForm } from '@/components/filter-form';
import { ResultStrip } from '@/components/result-strip';
import { Empty, Loading } from '@/components/states';
import { StatusText } from '@/components/status';
import { listCases, listSections, type CaseFilters } from '@/lib/queries';

export const metadata: Metadata = { title: 'Test cases' };

const AUTOMATION_LABEL = { manual: 'Manual', automated: 'Automated', planned: 'Planned' } as const;

export default function CasesPage({ searchParams }: PageProps<'/cases'>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Test cases</h1>
          <p className="mt-1 text-muted">Documented cases, with their latest automated results.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href="/cases/import">
            Import sheet
          </Link>
          <Link className="btn btn-primary" href="/cases/new">
            New test case
          </Link>
        </div>
      </div>
      <Suspense fallback={<Loading what="test cases" rows={8} />}>
        <CasesTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

async function CasesTable({ searchParams }: { searchParams: PageProps<'/cases'>['searchParams'] }) {
  const sp = await searchParams;
  const filters: CaseFilters = { q: one(sp.q), section: one(sp.section), automation: one(sp.automation), last: one(sp.last) };
  const filtered = Object.values(filters).some(Boolean);
  const [sections, cases] = await Promise.all([listSections(), listCases(filters)]);

  if (!cases.length && !filtered) {
    return (
      <Empty>
        <p className="font-medium">No test cases yet.</p>
        <p className="mt-1">
          Start from the existing sheet:{' '}
          <Link className="link" href="/cases/import">
            import it as .xlsx or .csv
          </Link>
          , or{' '}
          <Link className="link" href="/cases/new">
            add one case by hand
          </Link>
          .
        </p>
      </Empty>
    );
  }

  return (
    <>
      {/* Keyed by the filters so the fields show the current URL after a filter or "Clear filters". */}
      <FilterForm key={JSON.stringify(filters)} action="/cases" className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px] flex-1">
          <span className="label">Search ID or title</span>
          <input name="q" type="search" className="field" defaultValue={filters.q} />
        </label>
        <label className="block">
          <span className="label">Section</span>
          <select name="section" className="field w-auto max-w-[260px]" defaultValue={filters.section ?? ''}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Automation</span>
          <select name="automation" className="field w-auto" defaultValue={filters.automation ?? ''}>
            <option value="">Any</option>
            <option value="automated">Automated</option>
            <option value="manual">Manual</option>
            <option value="planned">Planned</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Latest result</span>
          <select name="last" className="field w-auto" defaultValue={filters.last ?? ''}>
            <option value="">Any</option>
            <option value="failing">Failed or broken</option>
            <option value="flaky">Flaky</option>
            <option value="none">No results yet</option>
          </select>
        </label>
        <button type="submit" className="btn">
          Filter
        </button>
        {filtered ? (
          <Link className="link inline-flex min-h-[36px] items-center" href="/cases">
            Clear filters
          </Link>
        ) : null}
      </FilterForm>

      <p className="text-muted" aria-live="polite">
        {cases.length} {cases.length === 1 ? 'case' : 'cases'}
      </p>

      {cases.length ? (
        <div className="table-frame">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Title</th>
                <th scope="col">Latest result</th>
                <th scope="col">Last results</th>
                <th scope="col">Automation</th>
                <th scope="col">Section</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const last = c.history[c.history.length - 1];
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="link mono whitespace-nowrap" href={`/cases/${encodeURIComponent(c.caseKey)}`}>
                        {c.caseKey}
                      </Link>
                    </td>
                    <td className="min-w-[260px]">{c.title}</td>
                    <td>{last ? <StatusText status={last.status} knownBug={last.knownBug} /> : <span className="text-muted">None</span>}</td>
                    <td>
                      <ResultStrip statuses={c.history.map((h) => h.status)} label={`Last results of ${c.caseKey}`} />
                    </td>
                    <td>{AUTOMATION_LABEL[c.automation]}</td>
                    <td className="text-muted">{c.section}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No cases match these filters.</p>
      )}
    </>
  );
}
