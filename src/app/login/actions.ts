'use server';

import { and, count, eq, gt, isNull, lt } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginTokens, sessions, users } from '@/db/schema';
import { db } from '@/lib/db';
import { mailMode, sendSignInEmail } from '@/lib/auth/mail';
import {
  allowlistIsEmpty,
  hashToken,
  isAllowed,
  isValidEmail,
  LINK_MINUTES,
  MAX_LINKS_PER_WINDOW,
  newToken,
  normalizeEmail,
  parseAllowlist,
  safeNextPath,
} from '@/lib/auth/rules';
import { endSession, startSession } from '@/lib/auth/session';

export interface RequestState {
  sentTo?: string;
  error?: string;
}

/**
 * Links in emails are built from APP_URL. Building them from the request's Host header would let
 * anyone who can send a forged Host make a real user's link point at another site.
 */
async function appUrl(): Promise<string | null> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return null;
  const h = await headers();
  return `http://${h.get('host') ?? 'localhost:3000'}`;
}

export async function requestLink(_prev: RequestState, fd: FormData): Promise<RequestState> {
  const email = normalizeEmail(String(fd.get('email') ?? ''));
  if (!isValidEmail(email)) return { error: 'Enter an email address, like name@example.com.' };

  const allowlist = parseAllowlist(process.env.ALLOWED_EMAILS);
  if (allowlistIsEmpty(allowlist)) return { error: 'Sign-in is not set up yet: ALLOWED_EMAILS is empty on this server.' };
  const base = await appUrl();
  if (!base) return { error: 'Sign-in is not set up yet: APP_URL is missing on this server.' };
  if (!mailMode()) return { error: 'Sign-in emails are not set up on this server (SMTP_URL is missing).' };

  // From here on, every outcome shows the same message, so the page never tells a stranger
  // which addresses are allowed.
  const sent: RequestState = { sentTo: email };
  if (!isAllowed(email, allowlist)) return sent;

  const now = new Date();
  const windowStart = new Date(now.getTime() - LINK_MINUTES * 60 * 1000);
  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, windowStart));
  const [{ n }] = await db
    .select({ n: count() })
    .from(loginTokens)
    .where(and(eq(loginTokens.email, email), gt(loginTokens.createdAt, windowStart)));
  if (n >= MAX_LINKS_PER_WINDOW) return sent;

  const token = newToken();
  await db.insert(loginTokens).values({
    email,
    tokenHash: hashToken(token),
    nextPath: safeNextPath(fd.get('next')),
    expiresAt: new Date(now.getTime() + LINK_MINUTES * 60 * 1000),
  });
  const mail = await sendSignInEmail(email, `${base}/login/verify?token=${encodeURIComponent(token)}`);
  if (!mail.ok) return { error: mail.reason };
  return sent;
}

export interface SignInState {
  error?: string;
}

/** Runs from the button on the link page, not on opening the link: mail scanners that open links do not sign anyone in. */
export async function signIn(token: string): Promise<SignInState> {
  const [used] = await db
    .update(loginTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())))
    .returning({ email: loginTokens.email, nextPath: loginTokens.nextPath });
  if (!used) return { error: 'This link has expired or was already used.' };

  // The address could have been removed from the list after the link was sent.
  if (!isAllowed(used.email, parseAllowlist(process.env.ALLOWED_EMAILS))) {
    return { error: 'This address is no longer allowed to sign in.' };
  }

  const [user] = await db
    .insert(users)
    .values({ email: used.email, lastSignInAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { lastSignInAt: new Date() } })
    .returning({ id: users.id });
  // Tidy this user's expired sessions while we are here.
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, new Date())));
  await startSession(user.id);
  redirect(safeNextPath(used.nextPath));
}

export async function signOut() {
  await endSession();
  redirect('/login');
}
