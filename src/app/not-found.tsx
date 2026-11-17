import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
      <h1>Not found</h1>
      <p className="mt-2">There is no page here. It may have been a case or run that was removed.</p>
      <p className="mt-4 flex gap-4">
        <Link className="link" href="/cases">
          Test cases
        </Link>
        <Link className="link" href="/runs">
          Runs
        </Link>
      </p>
    </main>
  );
}
