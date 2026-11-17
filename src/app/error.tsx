'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
      <div role="alert" className="border border-failed bg-surface px-4 py-5">
      <h1>This page could not load</h1>
      <p className="mt-2">
        The hub could not read from its database. If this keeps happening, check that the database is running and that
        <span className="mono"> DATABASE_URL</span> is set.
      </p>
      <p className="mono mt-2 text-muted">{error.digest ? `Error reference: ${error.digest}` : error.message}</p>
      <button type="button" className="btn mt-4" onClick={reset}>
        Try again
      </button>
      </div>
    </main>
  );
}
