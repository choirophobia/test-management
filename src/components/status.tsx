import type { ResultStatus } from '@/db/schema';

export const STATUS_ORDER: ResultStatus[] = ['failed', 'broken', 'flaky', 'passed', 'skipped'];

export const STATUS_LABEL: Record<ResultStatus, string> = {
  passed: 'Passed',
  flaky: 'Flaky',
  failed: 'Failed',
  broken: 'Broken',
  skipped: 'Skipped',
};

export const STATUS_HELP: Record<ResultStatus, string> = {
  passed: 'Passed on the first attempt',
  flaky: 'Failed, then passed on retry',
  failed: 'An assertion failed on every attempt',
  broken: 'Setup or environment error, not an assertion',
  skipped: 'Not run (fixme, manual-only or skipped)',
};

const TEXT_CLASS: Record<ResultStatus, string> = {
  passed: 'text-passed',
  flaky: 'text-flaky',
  failed: 'text-failed',
  broken: 'text-broken',
  skipped: 'text-muted',
};

export const CELL_CLASS: Record<ResultStatus, string> = {
  passed: 'bg-passed',
  flaky: 'bg-flaky',
  failed: 'bg-failed',
  broken: 'bg-broken',
  skipped: 'bg-skipped',
};

/** The status word in its color. The word carries the meaning; the color only speeds up scanning. */
export function StatusText({ status, knownBug }: { status: ResultStatus; knownBug?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className={`font-medium ${TEXT_CLASS[status]}`} title={STATUS_HELP[status]}>
        {STATUS_LABEL[status]}
      </span>
      {knownBug ? (
        <span className="text-muted" title="Passes while the known bug still reproduces">
          , known bug
        </span>
      ) : null}
    </span>
  );
}
