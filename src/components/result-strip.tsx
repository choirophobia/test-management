import type { ResultStatus } from '@/db/schema';
import type { StatusCounts } from '@/lib/ingest/types';
import { CELL_CLASS, STATUS_LABEL, STATUS_ORDER } from './status';

/** One square per result, oldest first. The motif from DESIGN.md: trend at a glance. */
export function ResultStrip({ statuses, label }: { statuses: ResultStatus[]; label: string }) {
  if (!statuses.length) return <span className="text-muted">No results yet</span>;
  const summary = statuses.map((s) => STATUS_LABEL[s].toLowerCase()).join(', ');
  return (
    <span role="img" aria-label={`${label}, oldest to newest: ${summary}`} className="inline-flex gap-[2px] align-middle">
      {statuses.map((s, i) => (
        <span key={i} className={`block size-[10px] ${CELL_CLASS[s]}`} />
      ))}
    </span>
  );
}

export function countsText(c: StatusCounts): string {
  const parts = STATUS_ORDER.filter((s) => c[s] > 0).map((s) => `${c[s]} ${STATUS_LABEL[s].toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'no results';
}

/** Proportional bar for a whole run. Always shown next to countsText, never alone. */
export function TallyBar({ counts, className = '' }: { counts: StatusCounts; className?: string }) {
  const total = STATUS_ORDER.reduce((n, s) => n + counts[s], 0);
  if (!total) return null;
  return (
    <span aria-hidden="true" className={`flex h-[6px] w-full min-w-[80px] overflow-hidden bg-rule ${className}`}>
      {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={CELL_CLASS[s]} style={{ width: `${(counts[s] / total) * 100}%` }} />
      ))}
    </span>
  );
}
