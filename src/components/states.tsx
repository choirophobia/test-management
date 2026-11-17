/** Loading state: says what is loading, keeps roughly the height of what will arrive. */
export function Loading({ what, rows = 4 }: { what: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="border border-rule bg-surface">
      <p className="px-3 py-2 text-muted">Loading {what}…</p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[33px] border-t border-rule" />
      ))}
    </div>
  );
}

/** Empty state: why it is empty, and the one action that fills it. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-rule bg-surface px-4 py-5">{children}</div>;
}
