import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequestLinkForm } from './request-link-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="space-y-4">
      <h1>Sign in</h1>
      <Suspense fallback={<p className="text-muted">Loading the sign-in form…</p>}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next, expired } = await searchParams;
  return (
    <>
      {expired ? (
        <p role="status" className="border border-rule bg-surface px-3 py-2">
          Your session ended. Sign in again to continue.
        </p>
      ) : null}
      <p>Enter your email and we will send you a link that signs you in. No password needed.</p>
      <RequestLinkForm next={typeof next === 'string' ? next : '/'} />
    </>
  );
}
