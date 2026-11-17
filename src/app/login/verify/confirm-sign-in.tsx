'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signIn, type SignInState } from '../actions';

export function ConfirmSignIn({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SignInState>(() => signIn(token), {});
  if (state.error) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-failed">{state.error}</p>
        <Link className="link" href="/login">
          Get a new link
        </Link>
      </div>
    );
  }
  return (
    <form action={action}>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in to MSL Test Hub'}
      </button>
    </form>
  );
}
