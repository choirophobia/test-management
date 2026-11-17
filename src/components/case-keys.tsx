import Link from 'next/link';

/** Case IDs of a result. IDs with a case in the hub link to it; the rest are marked as missing. */
export function CaseKeys({ keys, known }: { keys: string[]; known: Set<string> }) {
  if (!keys.length) return <span className="text-muted">No ID</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {keys.map((k) =>
        known.has(k) ? (
          <Link key={k} className="link mono whitespace-nowrap" href={`/cases/${encodeURIComponent(k)}`}>
            {k}
          </Link>
        ) : (
          <span key={k} className="mono whitespace-nowrap" title="No test case with this ID in the hub">
            {k} <span className="font-sans text-muted">(not in hub)</span>
          </span>
        ),
      )}
    </span>
  );
}
