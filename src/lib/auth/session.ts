import 'server-only';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessions, users } from '@/db/schema';
import { db } from '@/lib/db';
import { hashToken, newToken, SESSION_DAYS } from './rules';

export const SESSION_COOKIE = 'hub_session';

export interface SignedInUser {
  id: number;
  email: string;
}

/** The signed-in user, or null. Reads the request, so callers sit behind a Suspense boundary. */
export async function getCurrentUser(): Promise<SignedInUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

/** Every page read and every Server Action goes through this. */
export async function requireUser(): Promise<SignedInUser> {
  const user = await getCurrentUser();
  // The cookie was there (the proxy let the request through) but is expired or revoked.
  if (!user) redirect('/login?expired=1');
  return user;
}

/** Only from a Server Action or Route Handler: that is where cookies can be set. */
export async function startSession(userId: number) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}
