'use server';

import { eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PLATFORMS, testCases, type Platform } from '@/db/schema';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { caseInput, findHeaderRow, guessMapping, mapRows, parseCsv, type Mapping } from '@/lib/import/sheet';
import { readWorkbook } from '@/lib/import/xlsx';

export interface CaseFormState {
  errors: Partial<Record<string, string>>;
  message?: string;
}

const text = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

function readCaseForm(fd: FormData) {
  return caseInput.safeParse({
    caseKey: (text(fd, 'caseKey') ?? '').toUpperCase(),
    title: text(fd, 'title') ?? '',
    section: text(fd, 'section'),
    platforms: fd.getAll('platforms').filter((p): p is string => typeof p === 'string'),
    type: text(fd, 'type') ?? 'ui',
    priority: text(fd, 'priority'),
    preconditions: text(fd, 'preconditions'),
    steps: text(fd, 'steps'),
    expected: text(fd, 'expected'),
    automation: text(fd, 'automation') ?? 'manual',
    notes: text(fd, 'notes'),
  });
}

const fieldErrors = (error: z.ZodError) =>
  Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])) as CaseFormState['errors'];

export async function createCase(_prev: CaseFormState, fd: FormData): Promise<CaseFormState> {
  await requireUser();
  const parsed = readCaseForm(fd);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const [existing] = await db.select({ id: testCases.id }).from(testCases).where(eq(testCases.caseKey, parsed.data.caseKey));
  if (existing) return { errors: { caseKey: `${parsed.data.caseKey} already exists` } };
  await db.insert(testCases).values(parsed.data);
  revalidatePath('/cases');
  redirect(`/cases/${encodeURIComponent(parsed.data.caseKey)}`);
}

export async function updateCase(caseKey: string, _prev: CaseFormState, fd: FormData): Promise<CaseFormState> {
  await requireUser();
  fd.set('caseKey', caseKey); // The ID links past results, so it is not editable here.
  const parsed = readCaseForm(fd);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const updated = await db
    .update(testCases)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(testCases.caseKey, caseKey))
    .returning({ id: testCases.id });
  if (!updated.length) return { errors: {}, message: `${caseKey} no longer exists.` };
  revalidatePath('/cases');
  redirect(`/cases/${encodeURIComponent(caseKey)}`);
}

/* Import: step 1 reads the file, step 2 writes the mapped rows. */

export interface SheetState {
  error?: string;
  fileName?: string;
  sheets?: string[];
  sheet?: string;
  rows?: string[][];
  headerRow?: number;
  mapping?: Mapping;
}

const MAX_FILE = 5 * 1024 * 1024;

export async function readSheet(_prev: SheetState, fd: FormData): Promise<SheetState> {
  await requireUser();
  const file = fd.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a .xlsx or .csv file first.' };
  if (file.size > MAX_FILE) return { error: 'The file is larger than 5 MB. Export only the test case sheet as CSV.' };

  const name = file.name.toLowerCase();
  let sheets: { name: string; rows: string[][] }[];
  try {
    if (name.endsWith('.csv')) sheets = [{ name: 'CSV', rows: parseCsv(await file.text()) }];
    else if (name.endsWith('.xlsx')) sheets = await readWorkbook(await file.arrayBuffer());
    else return { error: 'Only .xlsx and .csv files can be imported. Save .xls files as .xlsx first.' };
  } catch {
    return { error: `Could not read ${file.name}. Open it in Excel or Sheets and save it again as .xlsx or .csv.` };
  }

  const wanted = text(fd, 'sheet');
  // The MSL master workbook keeps its cases on a sheet called "Test cases".
  const sheet =
    sheets.find((s) => s.name === wanted) ?? sheets.find((s) => /test ?cases?/i.test(s.name)) ?? sheets[0];
  if (!sheet || !sheet.rows.some((r) => r.some((c) => c.trim()))) {
    return { error: `The sheet "${sheet?.name ?? ''}" is empty.`, fileName: file.name, sheets: sheets.map((s) => s.name) };
  }
  const headerRow = findHeaderRow(sheet.rows);
  return {
    fileName: file.name,
    sheets: sheets.map((s) => s.name),
    sheet: sheet.name,
    rows: sheet.rows,
    headerRow,
    mapping: guessMapping(sheet.rows[headerRow]),
  };
}

export interface ImportResult {
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  invalid?: { row: number; reason: string }[];
}

const importRequest = z.object({
  rows: z.array(z.array(z.string())).max(20_000),
  headerRow: z.number().int().min(0),
  mapping: z.record(z.string(), z.number().int().min(0).nullable()),
  defaultPlatforms: z.array(z.enum(PLATFORMS)).min(1),
  existing: z.enum(['update', 'skip']),
});

export async function importCases(payload: unknown): Promise<ImportResult> {
  await requireUser();
  const req = importRequest.safeParse(payload);
  if (!req.success) return { error: 'The import request was not valid. Read the file again and retry.' };
  const { rows, headerRow, mapping, defaultPlatforms, existing } = req.data;
  if (mapping.caseKey == null || mapping.title == null) return { error: 'Pick the ID and Title columns.' };

  const { cases, invalid } = mapRows(rows, {
    headerRow,
    mapping: mapping as Mapping,
    defaultPlatforms: defaultPlatforms as Platform[],
  });
  if (!cases.length) return { created: 0, updated: 0, skipped: 0, invalid };

  const keys = cases.map((c) => c.caseKey);
  const before = new Set(
    (await db.select({ key: testCases.caseKey }).from(testCases).where(inArray(testCases.caseKey, keys))).map((r) => r.key),
  );
  const fresh = cases.filter((c) => !before.has(c.caseKey));
  const repeat = cases.filter((c) => before.has(c.caseKey));

  await db.transaction(async (tx) => {
    for (let i = 0; i < fresh.length; i += 500) await tx.insert(testCases).values(fresh.slice(i, i + 500));
    if (existing === 'update') {
      for (let i = 0; i < repeat.length; i += 500) {
        await tx
          .insert(testCases)
          .values(repeat.slice(i, i + 500))
          .onConflictDoUpdate({
            target: testCases.caseKey,
            set: {
              title: sql`excluded.title`,
              section: sql`excluded.section`,
              platforms: sql`excluded.platforms`,
              priority: sql`excluded.priority`,
              preconditions: sql`excluded.preconditions`,
              steps: sql`excluded.steps`,
              expected: sql`excluded.expected`,
              automation: sql`excluded.automation`,
              notes: sql`excluded.notes`,
              updatedAt: sql`now()`,
            },
          });
      }
    }
  });

  revalidatePath('/cases');
  revalidatePath('/');
  return {
    created: fresh.length,
    updated: existing === 'update' ? repeat.length : 0,
    skipped: existing === 'skip' ? repeat.length : 0,
    invalid,
  };
}
