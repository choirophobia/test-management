import type { Metadata } from 'next';
import Link from 'next/link';
import { createCase } from '../actions';
import { CaseForm } from '../case-form';

export const metadata: Metadata = { title: 'New test case' };

export default function NewCasePage() {
  return (
    <div className="space-y-4">
      <p className="text-muted">
        <Link className="link" href="/cases">
          Test cases
        </Link>{' '}
        / New
      </p>
      <h1>New test case</h1>
      <CaseForm action={createCase} cancelHref="/cases" />
    </div>
  );
}
