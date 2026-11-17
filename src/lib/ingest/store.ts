import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { PLATFORMS, results, runs, testCases } from '@/db/schema';
import { db } from '@/lib/db';
import { allurePayload, parseAllure } from './allure';
import { parseJUnit } from './junit';
import { countStatuses, type ParsedResult } from './types';

export const ingestBody = z
  .object({
    suite: z.string().trim().min(1).max(200),
    platform: z.enum(PLATFORMS),
    format: z.enum(['allure', 'junit']),
    results: allurePayload.optional(),
    // One string per JUnit file (WDIO writes one file per spec).
    junit: z.array(z.string().min(1)).max(2_000).optional(),
    startedAt: z.iso.datetime().optional(),
    github: z
      .object({
        runId: z.string().max(50),
        runAttempt: z.string().max(10).default('1'),
        runUrl: z.url().max(500).optional(),
        sha: z.string().max(64).optional(),
        branch: z.string().max(255).optional(),
        event: z.string().max(50).optional(),
      })
      .optional(),
  })
  .refine((b) => (b.format === 'allure' ? !!b.results : !!b.junit), {
    message: 'format "allure" needs "results"; format "junit" needs "junit"',
  });

export type IngestBody = z.infer<typeof ingestBody>;

export function parseBody(body: IngestBody): ParsedResult[] {
  if (body.format === 'allure') return parseAllure(body.results ?? []);
  return (body.junit ?? []).flatMap(parseJUnit);
}

export async function storeRun(body: IngestBody) {
  const parsed = parseBody(body);
  const counts = countStatuses(parsed);
  const starts = parsed.map((r) => r.startedAt).filter((n): n is number => n != null);
  const stops = parsed.map((r) => r.finishedAt).filter((n): n is number => n != null);
  const startedAt = body.startedAt ? new Date(body.startedAt) : starts.length ? new Date(Math.min(...starts)) : new Date();
  const finishedAt = stops.length ? new Date(Math.max(...stops)) : null;
  const externalId = body.github ? `${body.github.runId}-${body.github.runAttempt}` : null;

  const runId = await db.transaction(async (tx) => {
    // Re-uploading the same run attempt replaces it, so a retried upload step never duplicates a run.
    if (externalId) {
      await tx.delete(runs).where(and(eq(runs.suite, body.suite), eq(runs.externalId, externalId)));
    }
    const [run] = await tx
      .insert(runs)
      .values({
        suite: body.suite,
        platform: body.platform,
        format: body.format,
        externalId,
        githubRunUrl: body.github?.runUrl ?? null,
        githubEvent: body.github?.event ?? null,
        branch: body.github?.branch ?? null,
        commitSha: body.github?.sha ?? null,
        startedAt,
        finishedAt,
        ...counts,
      })
      .returning({ id: runs.id });

    for (let i = 0; i < parsed.length; i += 500) {
      const batch = parsed.slice(i, i + 500).map((r) => ({
        runId: run.id,
        name: r.name,
        fullName: r.fullName,
        epic: r.epic,
        feature: r.feature,
        variant: r.variant,
        status: r.status,
        knownBug: r.knownBug,
        attempts: r.attempts,
        durationMs: r.durationMs,
        message: r.message,
        trace: r.trace,
        caseKeys: r.caseKeys,
        tags: r.tags,
      }));
      await tx.insert(results).values(batch);
    }
    return run.id;
  });

  const keys = [...new Set(parsed.flatMap((r) => r.caseKeys))];
  const known = keys.length
    ? (await db.select({ key: testCases.caseKey }).from(testCases).where(inArray(testCases.caseKey, keys))).map((r) => r.key)
    : [];
  const knownSet = new Set(known);

  return {
    runId,
    counts,
    results: parsed.length,
    linkedCaseKeys: known.length,
    // IDs in test titles that have no case in the hub yet: usually a case missing from the import.
    unknownCaseKeys: keys.filter((k) => !knownSet.has(k)).sort(),
  };
}
