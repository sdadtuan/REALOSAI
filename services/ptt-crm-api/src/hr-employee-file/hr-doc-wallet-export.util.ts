import ExcelJS from 'exceljs';

export async function buildHrWalletAccountingXlsx(input: {
  walletRows: Array<{
    staff_id: number;
    name: string;
    internal_code: string;
    dept_name: string;
    wallet_pct: number;
    expiring_count: number;
    pending_count: number;
  }>;
  dependentRows: Array<{
    staff_id: number;
    staff_name: string;
    internal_code: string;
    dependent_name: string;
    relation: string;
    dob: string | null;
    tax_dependent: boolean;
    cccd: string;
  }>;
}): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const stamp = new Date().toISOString().slice(0, 10);

  const walletSheet = wb.addWorksheet('Ví giấy tờ');
  walletSheet.addRow(['Mã NV', 'Họ tên', 'Phòng ban', 'Ví %', 'Hết hạn', 'Chờ duyệt']);
  for (const row of input.walletRows) {
    walletSheet.addRow([
      row.internal_code || row.staff_id,
      row.name,
      row.dept_name,
      row.wallet_pct,
      row.expiring_count,
      row.pending_count,
    ]);
  }

  const depSheet = wb.addWorksheet('Người phụ thuộc');
  depSheet.addRow(['Mã NV', 'NV', 'Họ tên NPT', 'Quan hệ', 'Ngày sinh', 'PT TNCN', 'CCCD']);
  for (const row of input.dependentRows) {
    depSheet.addRow([
      row.internal_code || row.staff_id,
      row.staff_name,
      row.dependent_name,
      row.relation,
      row.dob ?? '',
      row.tax_dependent ? 'Có' : 'Không',
      row.cccd,
    ]);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `hr-wallet-accounting-${stamp}.xlsx` };
}
