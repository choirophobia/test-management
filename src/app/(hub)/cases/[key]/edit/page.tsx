import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Loading } from '@/components/states';
import { getCase } from '@/lib/queries';
import { updateCase } from '../../actions';
import { CaseForm } from '../../case-form';

export const metadata: Metadata = { title: 'Edit test case' };

export default function EditCasePage({ params }: PageProps<'/cases/[key]/edit'>) {
  return (
    <Suspense fallback={<Loading what="the test case" rows={6} />}>
      <EditCase params={params} />
    </Suspense>
  );
}

async function EditCase({ params }: Pick<PageProps<'/cases/[key]/edit'>, 'params'>) {
  const key = decodeURIComponent((await params).key);
  const c = await getCase(key);
  if (!c) notFound();
  const href = `/cases/${encodeURIComponent(c.caseKey)}`;
  return (
    <div className="space-y-4">
      <p className="text-muted">
        <Link className="link" href="/cases">
          Test cases
        </Link>{' '}
        /{' '}
        <Link className="link mono" href={href}>
          {c.caseKey}
        </Link>{' '}
        / Edit
      </p>
      <h1>Edit {c.caseKey}</h1>
      <CaseForm action={updateCase.bind(null, c.caseKey)} initial={c} cancelHref={href} />
    </div>
  );
}
