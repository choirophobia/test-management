import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { OUTBOX, SIGNED_IN_STATE } from '../playwright.config';

export const SIGNED_IN_EMAIL = 'qa@example.com';

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  execSync('npx drizzle-kit migrate', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  const sql = postgres(url, { max: 1 });
  await sql`truncate test_cases, runs, results, perf_metrics, login_tokens, sessions, users restart identity cascade`;
  rmSync(OUTBOX, { force: true });

  // The sign-in flow itself is tested in auth.spec.ts; every other test starts from this session,
  // stored the same way the app stores one (only the token's hash is in the database).
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [user] = await sql`insert into users (email) values (${SIGNED_IN_EMAIL}) returning id`;
  await sql`insert into sessions (token_hash, user_id, expires_at)
            values (${createHash('sha256').update(token).digest('hex')}, ${user.id}, ${expires})`;
  await sql.end();

  mkdirSync(path.dirname(SIGNED_IN_STATE), { recursive: true });
  writeFileSync(
    SIGNED_IN_STATE,
    JSON.stringify({
      cookies: [
        {
          name: 'hub_session',
          value: token,
          domain: 'localhost',
          path: '/',
          expires: Math.floor(expires.getTime() / 1000),
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
}
