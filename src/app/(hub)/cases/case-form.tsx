'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import { AUTOMATION, CASE_TYPES, PLATFORMS, type TestCase } from '@/db/schema';
import type { CaseFormState } from './actions';

const AUTOMATION_LABEL = { manual: 'Manual', automated: 'Automated', planned: 'Planned for automation' } as const;
const TYPE_LABEL = { ui: 'UI', api: 'API', performance: 'Performance' } as const;
const PLATFORM_LABEL = { web: 'Web', ios: 'iOS', android: 'Android', api: 'API' } as const;

type Action = (prev: CaseFormState, fd: FormData) => Promise<CaseFormState>;

export function CaseForm({ action, initial, cancelHref }: { action: Action; initial?: TestCase; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const e = state.errors;
  // Next keeps visited pages in the document (hidden), so plain ids like "title" would repeat across pages.
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const field = (name: string, label: string, opts: { rows?: number; required?: boolean; hint?: string } = {}) => {
    const value = initial ? ((initial as unknown as Record<string, string | null>)[name] ?? '') : '';
    const describedBy = [opts.hint ? id(`${name}-hint`) : null, e[name] ? id(`${name}-error`) : null].filter(Boolean).join(' ');
    const common = {
      id: id(name),
      name,
      defaultValue: value,
      required: opts.required,
      'aria-invalid': e[name] ? true : undefined,
      'aria-describedby': describedBy || undefined,
      className: 'field',
    };
    return (
      <div>
        <label className="label" htmlFor={id(name)}>
          {label}
          {opts.required ? null : <span className="font-normal text-muted"> (optional)</span>}
        </label>
        {opts.rows ? <textarea rows={opts.rows} {...common} /> : <input type="text" {...common} />}
        {opts.hint ? (
          <p id={id(`${name}-hint`)} className="mt-1 text-muted">
            {opts.hint}
          </p>
        ) : null}
        {e[name] ? (
          <p id={id(`${name}-error`)} className="mt-1 text-failed">
            {e[name]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form action={formAction} className="max-w-[760px] space-y-4" noValidate>
      {state.message ? (
        <p role="alert" className="border border-failed bg-surface px-3 py-2">
          {state.message}
        </p>
      ) : null}
      {Object.keys(e).length ? (
        <p role="alert" className="text-failed">
          Fix the fields marked below.
        </p>
      ) : null}

      {initial ? (
        <p>
          <span className="text-muted">ID </span>
          <span className="mono">{initial.caseKey}</span>
          <span className="text-muted"> (fixed: past results link to it)</span>
        </p>
      ) : (
        field('caseKey', 'ID', { required: true, hint: 'The ID automated test titles start with, e.g. AUTH-001.' })
      )}
      {field('title', 'Title', { required: true })}
      {field('section', 'Section', { hint: 'As in the sheet, e.g. "1. Authentication".' })}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={id('automation')}>
            Automation
          </label>
          <select id={id('automation')} name="automation" className="field" defaultValue={initial?.automation ?? 'manual'}>
            {AUTOMATION.map((a) => (
              <option key={a} value={a}>
                {AUTOMATION_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id('type')}>
            Type
          </label>
          <select id={id('type')} name="type" className="field" defaultValue={initial?.type ?? 'ui'}>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {field('priority', 'Priority')}
      </div>

      <fieldset aria-describedby={e.platforms ? id('platforms-error') : undefined}>
        <legend className="label">Platforms</legend>
        <div className="flex flex-wrap gap-x-5">
          {PLATFORMS.map((p) => (
            <label key={p} className="inline-flex min-h-[44px] items-center gap-2">
              <input
                type="checkbox"
                name="platforms"
                value={p}
                defaultChecked={initial ? initial.platforms.includes(p) : p === 'web'}
                className="size-4 accent-[var(--accent)]"
              />
              {PLATFORM_LABEL[p]}
            </label>
          ))}
        </div>
        {e.platforms ? (
          <p id={id('platforms-error')} className="text-failed">
            {e.platforms}
          </p>
        ) : null}
      </fieldset>

      {field('preconditions', 'Preconditions', { rows: 3 })}
      {field('steps', 'Steps', { rows: 6 })}
      {field('expected', 'Expected result', { rows: 4 })}
      {field('notes', 'Notes', { rows: 3 })}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Create test case'}
        </button>
        <Link className="link" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
