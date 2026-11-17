import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LocalTime } from '@/components/local-time';
import { ResultStrip } from '@/components/result-strip';
import { Loading } from '@/components/states';
import { StatusText } from '@/components/status';
import { caseHistory, getCase } from '@/lib/queries';

export const metadata: Metadata = { title: 'Test case' };

const PLATFORM_LABEL = { web: 'Web', ios: 'iOS', android: 'Android', api: 'API' } as const;
const AUTOMATION_LABEL = { manual: 'Manual', automated: 'Automated', planned: 'Planned for automation' } as const;
const TYPE_LABEL = { ui: 'UI', api: 'API', performance: 'Performance' } as const;

export default function CasePage({ params }: PageProps<'/cases/[key]'>) {
  return (
    <Suspense fallback={<Loading what="the test case" rows={6} />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}

function Block({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <section>
      <h2>{title}</h2>
      <p className="mt-1 whitespace-pre-wrap">{body}</p>
    </section>
  );
}

async function CaseDetail({ params }: Pick<PageProps<'/cases/[key]'>, 'params'>) {
  const key = decodeURIComponent((await params).key);
  const c = await getCase(key);
  if (!c) notFound();
  const history = await caseHistory(key);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted">
          <Link className="link" href="/cases">
            Test cases
          </Link>{' '}
          / <span className="mono">{c.caseKey}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1>
            <span className="mono font-medium">{c.caseKey}</span> {c.title}
          </h1>
          <Link className="btn" href={`/cases/${encodeURIComponent(c.caseKey)}/edit`}>
            Edit
          </Link>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {c.section ? (
            <div>
              <dt className="inline text-muted">Section </dt>
              <dd className="inline">{c.section}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline text-muted">Platforms </dt>
            <dd className="inline">{c.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Type </dt>
            <dd className="inline">{TYPE_LABEL[c.type]}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Automation </dt>
            <dd className="inline">{AUTOMATION_LABEL[c.automation]}</dd>
          </div>
          {c.priority ? (
            <div>
              <dt className="inline text-muted">Priority </dt>
              <dd className="inline">{c.priority}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Block title="Preconditions" body={c.preconditions} />
          <Block title="Steps" body={c.steps} />
          <Block title="Expected result" body={c.expected} />
          <Block title="Notes" body={c.notes} />
          {!c.preconditions && !c.steps && !c.expected && !c.notes ? (
            <p className="text-muted">
              No steps or expected result written yet.{' '}
              <Link className="link" href={`/cases/${encodeURIComponent(c.caseKey)}/edit`}>
                Add them
              </Link>
            </p>
          ) : null}
        </div>

        <section aria-label="Automated results">
        <h2>Automated results</h2>
          {history.length ? (
            <>
              <p className="mt-1">
                <ResultStrip
                  statuses={history.map((h) => h.result.status).reverse()}
                  label={`Results of ${c.caseKey}`}
                />
              </p>
              <div className="table-frame mt-2">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Run</th>
                      <th scope="col">Status</th>
                      <th scope="col">Browser / device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(({ result, run }) => (
                      <tr key={result.id}>
                        <td>
                          <Link className="link" href={`/runs/${run.id}#result-${result.id}`}>
                            <LocalTime date={run.startedAt} />
                          </Link>
                          <p className="text-muted">{run.suite}</p>
                        </td>
                        <td>
                          <StatusText status={result.status} knownBug={result.knownBug} />
                        </td>
                        <td>{result.variant ?? <span className="text-muted">Not reported</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-1">
              No automated results yet. Results link here when a test title starts with{' '}
              <span className="mono">{c.caseKey}</span>.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
