import Papa from 'papaparse';
import { z } from 'zod';
import { AUTOMATION, CASE_TYPES, PLATFORMS, type Automation, type Platform } from '@/db/schema';

export const FIELDS = [
  { key: 'caseKey', label: 'ID', required: true },
  { key: 'title', label: 'Title', required: true },
  { key: 'section', label: 'Section', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'preconditions', label: 'Preconditions', required: false },
  { key: 'steps', label: 'Steps', required: false },
  { key: 'expected', label: 'Expected result', required: false },
  { key: 'automation', label: 'Automated', required: false },
  { key: 'platforms', label: 'Platforms', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

export type FieldKey = (typeof FIELDS)[number]['key'];
export type Mapping = Record<FieldKey, number | null>;

// Header names seen in QA sheets, lower-cased. First match wins, so exact names come first.
const HEADER_GUESSES: Record<FieldKey, RegExp> = {
  caseKey: /^(id|case id|test id|tc id|test case id|tc no\.?|no\.?)$/,
  title: /^(title|test case|test case title|scenario|test scenario|summary|name|description)$/,
  section: /^(section|module|feature|area|category|suite)$/,
  priority: /^(priority|severity|prio)$/,
  preconditions: /^(pre-?conditions?|prerequisites?|setup)$/,
  steps: /^(steps|test steps|steps to reproduce|procedure)$/,
  expected: /^(expected|expected result|expected results|expected outcome)$/,
  automation: /^(automated|automation|automation status|is automated)$/,
  platforms: /^(platforms?|device|devices)$/,
  notes: /^(notes?|comments?|remarks?)$/,
};

const CASE_KEY = /^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+$/;

export function guessMapping(headers: string[]): Mapping {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const used = new Set<number>();
  const mapping = {} as Mapping;
  for (const f of FIELDS) {
    const i = normalized.findIndex((h, idx) => !used.has(idx) && HEADER_GUESSES[f.key].test(h));
    mapping[f.key] = i >= 0 ? i : null;
    if (i >= 0) used.add(i);
  }
  return mapping;
}

/** The header is the first row (within the top 15) that has an ID-like column name; else the first non-empty row. */
export function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    if (rows[i].some((c) => HEADER_GUESSES.caseKey.test(c.trim().toLowerCase()))) return i;
  }
  return Math.max(
    0,
    rows.findIndex((r) => r.some((c) => c.trim())),
  );
}

export function parseCsv(text: string): string[][] {
  const out = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false });
  return out.data.map((r) => r.map((c) => (c ?? '').toString()));
}

export function parseAutomation(value: string): Automation {
  const v = value.trim().toLowerCase();
  if (['yes', 'y', 'true', 'automated', 'done', '✓', 'x'].includes(v)) return 'automated';
  if (['planned', 'in progress', 'wip', 'to do', 'todo', 'partial'].includes(v)) return 'planned';
  return 'manual';
}

export function parsePlatforms(value: string, fallback: Platform[]): Platform[] {
  const v = value.toLowerCase();
  const found = PLATFORMS.filter((p) => v.includes(p));
  if (/\bmobile\b/.test(v)) found.push('ios', 'android');
  if (/\ball\b/.test(v)) return [...PLATFORMS].filter((p) => p !== 'api');
  return found.length ? [...new Set(found)] : fallback;
}

export const caseInput = z.object({
  caseKey: z.string().trim().regex(CASE_KEY, 'ID must look like AUTH-001').max(40),
  title: z.string().trim().min(1, 'Title is required').max(500),
  section: z.string().trim().max(200).nullable(),
  platforms: z.array(z.enum(PLATFORMS)).min(1, 'Pick at least one platform'),
  type: z.enum(CASE_TYPES),
  priority: z.string().trim().max(40).nullable(),
  preconditions: z.string().trim().max(10_000).nullable(),
  steps: z.string().trim().max(20_000).nullable(),
  expected: z.string().trim().max(10_000).nullable(),
  automation: z.enum(AUTOMATION),
  notes: z.string().trim().max(10_000).nullable(),
});
export type CaseInput = z.infer<typeof caseInput>;

export interface MapOptions {
  headerRow: number;
  mapping: Mapping;
  defaultPlatforms: Platform[];
}

export interface MappedRows {
  cases: CaseInput[];
  invalid: { row: number; reason: string }[];
}

/**
 * Turns sheet rows into cases. A row with no ID whose only text is in its first cell is read as a
 * section heading ("10. Web-only additions") and applies to the rows under it, unless a Section
 * column is mapped. Row numbers in errors are the sheet's own (1-based).
 */
export function mapRows(rows: string[][], { headerRow, mapping, defaultPlatforms }: MapOptions): MappedRows {
  const cell = (r: string[], f: FieldKey) => {
    const i = mapping[f];
    return i == null ? '' : (r[i] ?? '').trim();
  };
  const orNull = (s: string) => (s ? s : null);

  const cases: CaseInput[] = [];
  const invalid: MappedRows['invalid'] = [];
  const seen = new Map<string, number>();
  let headingSection: string | null = null;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const filled = r.map((c) => c.trim()).filter(Boolean);
    if (!filled.length) continue;

    // A heading is a lone value in the first or the ID column that is not itself an ID.
    const lone = filled.length === 1 ? r.findIndex((c) => c.trim()) : -1;
    if (lone >= 0 && (lone === 0 || lone === mapping.caseKey) && !CASE_KEY.test(filled[0]) && mapping.section == null) {
      headingSection = filled[0];
      continue;
    }
    const key = cell(r, 'caseKey').toUpperCase();
    if (!key) {
      invalid.push({ row: i + 1, reason: 'No ID' });
      continue;
    }

    const parsed = caseInput.safeParse({
      caseKey: key,
      title: cell(r, 'title'),
      section: mapping.section != null ? orNull(cell(r, 'section')) : headingSection,
      platforms: mapping.platforms != null ? parsePlatforms(cell(r, 'platforms'), defaultPlatforms) : defaultPlatforms,
      type: 'ui',
      priority: orNull(cell(r, 'priority')),
      preconditions: orNull(cell(r, 'preconditions')),
      steps: orNull(cell(r, 'steps')),
      expected: orNull(cell(r, 'expected')),
      automation: mapping.automation != null ? parseAutomation(cell(r, 'automation')) : 'manual',
      notes: orNull(cell(r, 'notes')),
    });
    if (!parsed.success) {
      invalid.push({ row: i + 1, reason: `${key}: ${parsed.error.issues.map((x) => x.message).join(', ')}` });
      continue;
    }
    if (seen.has(key)) {
      invalid.push({ row: i + 1, reason: `${key}: same ID as row ${seen.get(key)}` });
      continue;
    }
    seen.set(key, i + 1);
    cases.push(parsed.data);
  }
  return { cases, invalid };
}
