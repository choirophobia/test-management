'use client';

import Link from 'next/link';
import { startTransition, useActionState, useId, useMemo, useRef, useState, useTransition } from 'react';
import { PLATFORMS, type Platform } from '@/db/schema';
import { FIELDS, mapRows, type FieldKey, type Mapping } from '@/lib/import/sheet';
import { importCases, readSheet, type ImportResult, type SheetState } from '../actions';

const PLATFORM_LABEL = { web: 'Web', ios: 'iOS', android: 'Android', api: 'API' } as const;
const AUTOMATION_LABEL = { manual: 'Manual', automated: 'Automated', planned: 'Planned' } as const;

export function ImportFlow() {
  const [sheet, readAction, reading] = useActionState(readSheet, {} as SheetState);
  // React clears the form after the action runs, so the chosen file is kept here for switching sheets.
  const fileRef = useRef<File | null>(null);
  const uid = useId();

  const readOtherSheet = (name: string) => {
    if (!fileRef.current) return;
    const fd = new FormData();
    fd.set('file', fileRef.current);
    fd.set('sheet', name);
    startTransition(() => readAction(fd));
  };

  return (
    <div className="space-y-6">
      <form action={readAction} className="space-y-3 border border-rule bg-surface p-4">
        <h2>1. Choose the file</h2>
        <div>
          <label className="label" htmlFor={`${uid}-file`}>
            Test case sheet (.xlsx or .csv)
          </label>
          <input
            id={`${uid}-file`}
            name="file"
            type="file"
            accept=".xlsx,.csv"
            className="block max-w-full"
            required
            onChange={(e) => (fileRef.current = e.target.files?.[0] ?? null)}
          />
        </div>
        {sheet.sheets && sheet.sheets.length > 1 ? (
          <div>
            <label className="label" htmlFor={`${uid}-sheet`}>
              Sheet
            </label>
            <select
              id={`${uid}-sheet`}
              name="sheet"
              className="field w-auto"
              defaultValue={sheet.sheet}
              key={sheet.sheet}
              onChange={(e) => readOtherSheet(e.target.value)}
            >
              {sheet.sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="submit" className="btn" disabled={reading}>
          {reading ? 'Reading…' : 'Read file'}
        </button>
        {sheet.fileName && !sheet.error ? <p className="text-muted">Loaded {sheet.fileName}.</p> : null}
        {sheet.error ? (
          <p role="alert" className="text-failed">
            {sheet.error}
          </p>
        ) : null}
      </form>

      {sheet.rows && sheet.mapping && sheet.headerRow != null ? (
        <MapAndImport key={`${sheet.fileName}-${sheet.sheet}`} sheet={sheet as Required<SheetState>} />
      ) : null}
    </div>
  );
}

function MapAndImport({ sheet }: { sheet: Required<SheetState> }) {
  const [mapping, setMapping] = useState<Mapping>(sheet.mapping);
  const [platforms, setPlatforms] = useState<Platform[]>(['web']);
  const [existing, setExisting] = useState<'update' | 'skip'>('update');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, startImport] = useTransition();
  const uid = useId();

  const headers = sheet.rows[sheet.headerRow];
  const missingRequired = mapping.caseKey == null || mapping.title == null;
  // Same mapping code the server runs, so the preview matches what will be saved.
  const preview = useMemo(
    () =>
      missingRequired || !platforms.length
        ? null
        : mapRows(sheet.rows, { headerRow: sheet.headerRow, mapping, defaultPlatforms: platforms }),
    [sheet, mapping, platforms, missingRequired],
  );

  const setField = (key: FieldKey, value: string) => setMapping((m) => ({ ...m, [key]: value === '' ? null : Number(value) }));

  const submit = () =>
    startImport(async () => {
      setResult(
        await importCases({ rows: sheet.rows, headerRow: sheet.headerRow, mapping, defaultPlatforms: platforms, existing }),
      );
    });

  return (
    <div className="space-y-6">
      <section className="space-y-3 border border-rule bg-surface p-4" aria-label="2. Match the columns">
        <h2>2. Match the columns</h2>
        <p className="text-muted">
          Read {sheet.fileName}
          {sheet.sheets.length > 1 ? `, sheet "${sheet.sheet}"` : ''}. Header found on row {sheet.headerRow + 1}. Rows with only a
          heading (like &quot;1. Authentication&quot;) become the section of the rows below them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label" htmlFor={`${uid}-map-${f.key}`}>
                {f.label}
                {f.required ? null : <span className="font-normal text-muted"> (optional)</span>}
              </label>
              <select
                id={`${uid}-map-${f.key}`}
                className="field"
                value={mapping[f.key] ?? ''}
                aria-invalid={f.required && mapping[f.key] == null ? true : undefined}
                onChange={(e) => setField(f.key, e.target.value)}
              >
                <option value="">Not in this sheet</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h.trim() || `Column ${i + 1} (no header)`}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <fieldset>
          <legend className="label">Platforms for cases without a Platforms column</legend>
          <div className="flex flex-wrap gap-x-5">
            {PLATFORMS.map((p) => (
              <label key={p} className="inline-flex min-h-[44px] items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={platforms.includes(p)}
                  onChange={(e) => setPlatforms((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))}
                />
                {PLATFORM_LABEL[p]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Cases whose ID is already in the hub</legend>
          <div className="flex flex-wrap gap-x-5">
            <label className="inline-flex min-h-[44px] items-center gap-2">
              <input type="radio" name={`${uid}-existing`} checked={existing === 'update'} onChange={() => setExisting('update')} />
              Update them from the sheet
            </label>
            <label className="inline-flex min-h-[44px] items-center gap-2">
              <input type="radio" name={`${uid}-existing`} checked={existing === 'skip'} onChange={() => setExisting('skip')} />
              Keep the hub version
            </label>
          </div>
        </fieldset>
      </section>

      <section className="space-y-3 border border-rule bg-surface p-4" aria-label="3. Check and import">
        <h2>3. Check and import</h2>
        {missingRequired ? (
          <p className="text-failed">Pick the ID and Title columns to see what will be imported.</p>
        ) : !platforms.length ? (
          <p className="text-failed">Pick at least one platform.</p>
        ) : preview ? (
          <>
            <p>
              {preview.cases.length} cases ready to import
              {preview.invalid.length ? `, ${preview.invalid.length} rows will be left out (listed below)` : ''}.
            </p>
            {preview.cases.length ? (
              <div className="table-frame">
                <table className="data-table">
                  <caption className="px-3 py-2 text-left text-muted">First 5 cases as they will be saved</caption>
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Title</th>
                      <th scope="col">Section</th>
                      <th scope="col">Automation</th>
                      <th scope="col">Platforms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cases.slice(0, 5).map((c) => (
                      <tr key={c.caseKey}>
                        <td className="mono">{c.caseKey}</td>
                        <td>{c.title}</td>
                        <td className="text-muted">{c.section}</td>
                        <td>{AUTOMATION_LABEL[c.automation]}</td>
                        <td>{c.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {preview.invalid.length ? (
              <details>
                <summary className="text-muted hover:text-ink">Rows left out ({preview.invalid.length})</summary>
                <ul className="mt-1 list-disc pl-6">
                  {preview.invalid.slice(0, 200).map((x) => (
                    <li key={x.row}>
                      Row {x.row}: {x.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={submit} disabled={importing || !preview.cases.length}>
              {importing ? 'Importing…' : `Import ${preview.cases.length} cases`}
            </button>
          </>
        ) : null}

        {result ? (
          <div role="status" aria-live="polite" className={`border px-3 py-2 ${result.error ? 'border-failed' : 'border-passed'}`}>
            {result.error ? (
              <p className="text-failed">{result.error}</p>
            ) : (
              <p>
                Imported: {result.created} new, {result.updated} updated, {result.skipped} kept as they were.{' '}
                <Link className="link" href="/cases">
                  Open the test cases
                </Link>
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
