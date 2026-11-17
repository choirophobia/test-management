import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportFlow } from './import-flow';

export const metadata: Metadata = { title: 'Import test cases' };

export default function ImportPage() {
  return (
    <div className="max-w-[960px] space-y-4">
      <p className="text-muted">
        <Link className="link" href="/cases">
          Test cases
        </Link>{' '}
        / Import
      </p>
      <h1>Import test cases</h1>
      <p>
        Bring in the test case sheet. Each row needs an ID (the one automated test titles start with) and a title. Nothing is
        saved until you press Import in step 3, and importing again later updates the same cases instead of copying them.
      </p>
      <ImportFlow />
    </div>
  );
}
