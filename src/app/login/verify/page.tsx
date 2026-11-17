import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { loginTokens } from '@/db/schema';
import { hashToken } from '@/lib/auth/rules';
import { db } from '@/lib/db';
import { ConfirmSignIn } from './confirm-sign-in';

export const metadata: Metadata = { title: 'Sign in' };

export default function VerifyPage({ searchParams }: PageProps<'/login/verify'>) {
  return (
    <Suspense fallback={<p className="text-muted">Checking your sign-in link…</p>}>
      <Verify searchParams={searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: Pick<PageProps<'/login/verify'>, 'searchParams'>) {
  await connection();
  const { token } = await searchParams;
  // Opening the link only checks it; signing in needs the button, so a mail scanner opening it changes nothing.
  const [link] =
    typeof token === 'string' && token
      ? await db
          .select({ email: loginTokens.email })
          .from(loginTokens)
          .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
      : [];

  if (!link || typeof token !== 'string') {
    return (
      <div className="space-y-3">
        <h1>This link no longer works</h1>
        <p>Sign-in links work once, for 15 minutes. This one has expired or was already used.</p>
        <p>
          <Link className="link" href="/login">
            Get a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1>Sign in</h1>
      <p>
        Continue as <span className="font-medium">{link.email}</span>?
      </p>
      <ConfirmSignIn token={token} />
    </div>
  );
}
