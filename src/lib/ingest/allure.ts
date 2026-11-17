import { z } from 'zod';
import type { ResultStatus } from '@/db/schema';
import { caseKeysFromTitle, mergeCaseKeys } from './case-keys';
import { clip, type ParsedResult } from './types';

// Only the fields the hub reads. Steps and attachments are dropped by the uploader.
const allureResult = z.object({
  name: z.string(),
  fullName: z.string().optional(),
  historyId: z.string().optional(),
  status: z.enum(['passed', 'failed', 'broken', 'skipped', 'unknown']).optional(),
  statusDetails: z.object({ message: z.string().optional(), trace: z.string().optional() }).partial().optional(),
  labels: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  parameters: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  start: z.number().optional(),
  stop: z.number().optional(),
});
export type AllureResult = z.infer<typeof allureResult>;

export const allurePayload = z.array(allureResult).max(20_000);

const label = (r: AllureResult, name: string) => r.labels?.find((l) => l.name === name)?.value ?? null;
const labels = (r: AllureResult, name: string) => r.labels?.filter((l) => l.name === name).map((l) => l.value) ?? [];

/** Browser for Playwright ("Project" parameter, else the parentSuite label). */
function variantOf(r: AllureResult): string | null {
  return r.parameters?.find((p) => p.name === 'Project')?.value ?? label(r, 'parentSuite');
}

function attemptStatus(r: AllureResult): Exclude<ResultStatus, 'flaky'> {
  if (r.status === 'passed' || r.status === 'failed' || r.status === 'broken' || r.status === 'skipped') return r.status;
  return 'broken';
}

/**
 * Folds Allure attempts into one result per test and browser. A retried test writes one result
 * file per attempt with the same historyId (which already includes the browser); the last
 * attempt is the outcome, and a pass after a failure is "flaky".
 */
export function parseAllure(input: AllureResult[]): ParsedResult[] {
  const groups = new Map<string, AllureResult[]>();
  for (const r of input) {
    const key = r.historyId ?? `${r.fullName ?? r.name}::${variantOf(r) ?? ''}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const parsed: ParsedResult[] = [];
  for (const attempts of groups.values()) {
    attempts.sort((a, b) => (a.stop ?? 0) - (b.stop ?? 0));
    const last = attempts[attempts.length - 1];
    const lastStatus = attemptStatus(last);
    const failedAttempt = attempts.find((a) => attemptStatus(a) === 'failed' || attemptStatus(a) === 'broken');
    const status: ResultStatus = lastStatus === 'passed' && failedAttempt ? 'flaky' : lastStatus;
    // A flaky test keeps the message of the attempt that failed: that is the part worth reading.
    const detailsFrom = status === 'flaky' ? failedAttempt : last;
    const tags = labels(last, 'tag');

    parsed.push({
      name: last.name,
      fullName: last.fullName ?? null,
      epic: label(last, 'epic'),
      feature: label(last, 'feature'),
      variant: variantOf(last),
      status,
      knownBug: tags.includes('known-bug') || tags.includes('@known-bug') || /^\[known bug\]/i.test(last.name),
      attempts: attempts.length,
      durationMs: last.start != null && last.stop != null ? last.stop - last.start : null,
      message: clip(detailsFrom?.statusDetails?.message),
      trace: clip(detailsFrom?.statusDetails?.trace),
      caseKeys: mergeCaseKeys(caseKeysFromTitle(last.name), tags),
      tags: tags.filter((t) => t.startsWith('@') || t === 'known-bug'),
      startedAt: attempts[0].start ?? null,
      finishedAt: last.stop ?? null,
    });
  }
  return parsed;
}
