import { execSync } from 'node:child_process';
import postgres from 'postgres';

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  execSync('npx drizzle-kit migrate', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  const sql = postgres(url, { max: 1 });
  await sql`truncate test_cases, runs, results, perf_metrics restart identity cascade`;
  await sql.end();
}
