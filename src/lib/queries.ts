import 'server-only';
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { AUTOMATION, results, runs, testCases, type Automation, type ResultStatus, type Run } from '@/db/schema';
import { liveDb } from '@/lib/db';
import type { StatusCounts } from '@/lib/ingest/types';

export const runCounts = (r: Run): StatusCounts => ({
  passed: r.passed,
  flaky: r.flaky,
  failed: r.failed,
  broken: r.broken,
  skipped: r.skipped,
});

export interface CaseFilters {
  q?: string;
  section?: string;
  automation?: string;
  last?: string;
}

const HISTORY = 8;

/** Most recent results for each case ID, newest first (at most HISTORY per case). */
export async function recentResultsByCase(keys: string[]) {
  const db = await liveDb();
  if (!keys.length) return new Map<string, { status: ResultStatus; knownBug: boolean }[]>();
  const rows = await db.execute<{ key: string; status: ResultStatus; known_bug: boolean }>(sql`
    select key, status, known_bug from (
      select k.key, r.status, r.known_bug,
        row_number() over (partition by k.key order by ru.started_at desc, r.id desc) as n
      from ${results} r
      join ${runs} ru on ru.id = r.run_id
      cross join lateral unnest(r.case_keys) as k(key)
      where k.key in (${sql.join(
        keys.map((k) => sql`${k}`),
        sql`, `,
      )})
    ) t where n <= ${HISTORY}
    order by key, n desc
  `);
  const map = new Map<string, { status: ResultStatus; knownBug: boolean }[]>();
  for (const row of rows) {
    const list = map.get(row.key) ?? [];
    list.push({ status: row.status, knownBug: row.known_bug });
    map.set(row.key, list);
  }
  return map;
}

export async function listCases(f: CaseFilters) {
  const db = await liveDb();
  const where: SQL[] = [];
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    where.push(or(ilike(testCases.caseKey, q), ilike(testCases.title, q))!);
  }
  if (f.section) where.push(eq(testCases.section, f.section));
  if (f.automation && (AUTOMATION as readonly string[]).includes(f.automation)) {
    where.push(eq(testCases.automation, f.automation as Automation));
  }
  const cases = await db
    .select()
    .from(testCases)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(testCases.section), asc(testCases.caseKey));

  const history = await recentResultsByCase(cases.map((c) => c.caseKey));
  const rows = cases.map((c) => {
    const h = history.get(c.caseKey) ?? [];
    return { ...c, history: h, lastStatus: h.length ? h[h.length - 1].status : null };
  });

  if (f.last === 'failing') return rows.filter((r) => r.lastStatus === 'failed' || r.lastStatus === 'broken');
  if (f.last === 'flaky') return rows.filter((r) => r.lastStatus === 'flaky');
  if (f.last === 'none') return rows.filter((r) => r.lastStatus === null);
  return rows;
}

export async function listSections() {
  const db = await liveDb();
  const rows = await db
    .selectDistinct({ section: testCases.section })
    .from(testCases)
    .where(sql`${testCases.section} is not null`)
    .orderBy(asc(testCases.section));
  return rows.map((r) => r.section!);
}

export async function getCase(key: string) {
  const db = await liveDb();
  const [c] = await db.select().from(testCases).where(eq(testCases.caseKey, key));
  return c ?? null;
}

export async function caseHistory(key: string) {
  const db = await liveDb();
  return db
    .select({ result: results, run: runs })
    .from(results)
    .innerJoin(runs, eq(runs.id, results.runId))
    .where(sql`${key} = any(${results.caseKeys})`)
    .orderBy(desc(runs.startedAt), asc(results.variant))
    .limit(100);
}

export async function listSuites() {
  const db = await liveDb();
  const rows = await db.selectDistinct({ suite: runs.suite }).from(runs).orderBy(asc(runs.suite));
  return rows.map((r) => r.suite);
}

export async function listRuns(suite?: string) {
  const db = await liveDb();
  return db
    .select()
    .from(runs)
    .where(suite ? eq(runs.suite, suite) : undefined)
    .orderBy(desc(runs.startedAt))
    .limit(100);
}

export async function getRun(id: number) {
  const db = await liveDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  return run ?? null;
}

export async function runResults(id: number) {
  const db = await liveDb();
  return db
    .select()
    .from(results)
    .where(eq(results.runId, id))
    .orderBy(asc(results.epic), asc(results.feature), asc(results.name), asc(results.variant));
}

/** Which of these IDs exist as cases, so result rows only link to pages that exist. */
export async function existingCaseKeys(keys: string[]) {
  const db = await liveDb();
  if (!keys.length) return new Set<string>();
  const rows = await db.select({ key: testCases.caseKey }).from(testCases).where(inArray(testCases.caseKey, keys));
  return new Set(rows.map((r) => r.key));
}

/** The newest run of every suite, and its failing results. */
export async function latestRunsWithFailures() {
  const db = await liveDb();
  const latest = await db.execute<{ id: number }>(sql`
    select distinct on (suite) id from ${runs} order by suite, started_at desc
  `);
  const ids = latest.map((r) => Number(r.id));
  if (!ids.length) return { runs: [], failures: [] };
  const latestRuns = await db.select().from(runs).where(inArray(runs.id, ids)).orderBy(asc(runs.suite));
  const failures = await db
    .select()
    .from(results)
    .where(and(inArray(results.runId, ids), inArray(results.status, ['failed', 'broken'])))
    .orderBy(asc(results.runId), asc(results.epic), asc(results.name), asc(results.variant));
  return { runs: latestRuns, failures };
}

export async function caseStats() {
  const db = await liveDb();
  const rows = await db
    .select({ automation: testCases.automation, n: sql<number>`count(*)::int` })
    .from(testCases)
    .groupBy(testCases.automation);
  const by = Object.fromEntries(rows.map((r) => [r.automation, r.n])) as Partial<Record<Automation, number>>;
  const total = rows.reduce((n, r) => n + r.n, 0);
  return { total, automated: by.automated ?? 0, manual: by.manual ?? 0, planned: by.planned ?? 0 };
}
