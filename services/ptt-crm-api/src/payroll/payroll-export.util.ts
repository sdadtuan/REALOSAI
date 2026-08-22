import ExcelJS from 'exceljs';

export async function buildPayrollXlsx(
  bundle: Record<string, unknown>,
): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');
  const headers = (bundle.headers as string[]) ?? [];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const row of (bundle.rows as unknown[][]) ?? []) {
    ws.addRow(row);
  }
  if (bundle.include_summary && (bundle.summary_rows as unknown[][])?.length) {
    const summary = wb.addWorksheet('Summary');
    summary.addRow((bundle.summary_headers as string[]) ?? []);
    summary.getRow(1).font = { bold: true };
    for (const row of (bundle.summary_rows as unknown[][]) ?? []) {
      summary.addRow(row);
    }
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    filename: String(bundle.filename ?? 'payroll-export.xlsx'),
  };
}
