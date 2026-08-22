import ExcelJS from 'exceljs';
import { StaffKpiEntryRow } from './kpi.types';

export async function buildStaffKpiXlsx(
  rows: StaffKpiEntryRow[],
  year: number,
  month: number,
): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Staff KPI');
  ws.columns = [
    { header: 'Staff ID', key: 'staff_id', width: 10 },
    { header: 'Nhân viên', key: 'staff_name', width: 24 },
    { header: 'Mã NV', key: 'staff_code', width: 12 },
    { header: 'Metric ID', key: 'metric_id', width: 10 },
    { header: 'Chỉ tiêu', key: 'metric_name', width: 28 },
    { header: 'Mã', key: 'metric_code', width: 14 },
    { header: 'Target', key: 'target_value', width: 12 },
    { header: 'Actual', key: 'actual_value', width: 12 },
    { header: 'Đơn vị', key: 'metric_unit', width: 10 },
    { header: 'Trạng thái', key: 'status', width: 12 },
    { header: 'Ghi chú', key: 'note', width: 24 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow({
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      staff_code: row.staff_code,
      metric_id: row.metric_id,
      metric_name: row.metric_name,
      metric_code: row.metric_code,
      target_value: row.target_value,
      actual_value: row.actual_value,
      metric_unit: row.metric_unit,
      status: row.status,
      note: row.note,
    });
  }
  const stamp = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `staff-kpi-export-${stamp}.xlsx` };
}
