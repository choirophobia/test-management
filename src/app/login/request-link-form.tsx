'use client';

import { useActionState, useId } from 'react';
import { requestLink, type RequestState } from './actions';

const LINK_MINUTES = 15;

export function RequestLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestLink, {} as RequestState);
  const id = useId();

  if (state.sentTo) {
    return (
      <div role="status" className="space-y-3 border border-rule bg-surface px-4 py-4">
        <p className="font-medium">Check your email.</p>
        <p>
          If <span className="font-medium">{state.sentTo}</span> is allowed to sign in, a link is on its way. It works once,
          for {LINK_MINUTES} minutes.
        </p>
        <p className="text-muted">Nothing after a few minutes? Check spam, or ask whoever runs the hub to add your address.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor={`${id}-email`}>
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="field"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? `${id}-error` : undefined}
        />
        {state.error ? (
          <p id={`${id}-error`} role="alert" className="mt-1 text-failed">
            {state.error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
