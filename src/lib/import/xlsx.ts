import 'server-only';
import ExcelJS from 'exceljs';

/** Reads every sheet's displayed text (what the user sees in Excel, so formulas and dates come out as shown). */
export async function readWorkbook(buffer: ArrayBuffer): Promise<{ name: string; rows: string[][] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    const width = ws.columnCount;
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: string[] = [];
      for (let c = 1; c <= width; c++) cells.push(row.getCell(c).text ?? '');
      rows[rowNumber - 1] = cells;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    return { name: ws.name, rows };
  });
}
