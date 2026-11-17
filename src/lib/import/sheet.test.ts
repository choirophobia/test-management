import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { findHeaderRow, guessMapping, mapRows, parseAutomation, parseCsv } from './sheet';
import { readWorkbook } from './xlsx';

// Shaped like a QA sheet: a title row above the header, section heading rows, an ID-less row.
const csv = `MyStudyLife test cases v2,,,,,
ID,Test case,Steps,Expected result,Automated,Priority
1. Authentication,,,,,
AUTH-001,Valid credentials log in,"1. Open /login
2. Sign in",Dashboard opens,Yes,High
auth-002,Empty fields are blocked,Submit empty form,Field is required,no,Medium
,Row with text but no ID,,,,
10. Web-only additions,,,,,
WEB-02,Add exam from empty state,,Add Exam opens,planned,
WEB-02,Duplicate of the row above,,,,
WEB-03,,,,,
`;

describe('sheet import', () => {
  const rows = parseCsv(csv);
  const headerRow = findHeaderRow(rows);
  const mapping = guessMapping(rows[headerRow]);

  it('finds the header below a title row and guesses the columns', () => {
    expect(headerRow).toBe(1);
    expect(mapping).toMatchObject({ caseKey: 0, title: 1, steps: 2, expected: 3, automation: 4, priority: 5, section: null });
  });

  it('maps rows, carrying section headings down and upper-casing IDs', () => {
    const { cases } = mapRows(rows, { headerRow, mapping, defaultPlatforms: ['web', 'ios'] });
    expect(cases.map((c) => [c.caseKey, c.section, c.automation])).toEqual([
      ['AUTH-001', '1. Authentication', 'automated'],
      ['AUTH-002', '1. Authentication', 'manual'],
      ['WEB-02', '10. Web-only additions', 'planned'],
    ]);
    expect(cases[0].steps).toBe('1. Open /login\n2. Sign in');
    expect(cases[0].platforms).toEqual(['web', 'ios']);
  });

  it('reports rows it could not import, with the sheet row number', () => {
    const { invalid } = mapRows(rows, { headerRow, mapping, defaultPlatforms: ['web'] });
    expect(invalid).toEqual([
      { row: 6, reason: 'No ID' },
      { row: 9, reason: 'WEB-02: same ID as row 8' },
      { row: 10, reason: 'WEB-03: Title is required' },
    ]);
  });

  it.each([
    ['Yes', 'automated'],
    ['TRUE', 'automated'],
    ['In progress', 'planned'],
    ['', 'manual'],
    ['No', 'manual'],
  ])('reads "%s" in the Automated column as %s', (value, expected) => {
    expect(parseAutomation(value)).toBe(expected);
  });

  it('reads an .xlsx sheet as displayed text', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Test cases');
    ws.addRow(['ID', 'Title', 'Automated']);
    ws.addRow(['AUTH-001', 'Valid credentials log in', 'Yes']);
    wb.addWorksheet('Review notes').addRow(['old', 'new']);
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const sheets = await readWorkbook(buffer);
    expect(sheets.map((s) => s.name)).toEqual(['Test cases', 'Review notes']);
    expect(sheets[0].rows[1]).toEqual(['AUTH-001', 'Valid credentials log in', 'Yes']);
  });
});
