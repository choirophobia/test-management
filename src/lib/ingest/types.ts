import type { ResultStatus } from '@/db/schema';

/** One test in one variant (browser or device) after retries are folded together. */
export interface ParsedResult {
  name: string;
  fullName: string | null;
  epic: string | null;
  feature: string | null;
  variant: string | null;
  status: ResultStatus;
  knownBug: boolean;
  attempts: number;
  durationMs: number | null;
  message: string | null;
  trace: string | null;
  caseKeys: string[];
  tags: string[];
  startedAt: number | null;
  finishedAt: number | null;
}

export type StatusCounts = Record<ResultStatus, number>;

export function countStatuses(results: Pick<ParsedResult, 'status'>[]): StatusCounts {
  const counts: StatusCounts = { passed: 0, flaky: 0, failed: 0, broken: 0, skipped: 0 };
  for (const r of results) counts[r.status] += 1;
  return counts;
}

// Long traces are kept for reading, but capped so one runaway log cannot bloat the table.
export const MAX_TEXT = 20_000;
export function clip(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n[cut at ${MAX_TEXT} characters]` : text;
}
