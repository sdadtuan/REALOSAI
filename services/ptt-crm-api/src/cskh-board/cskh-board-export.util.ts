import ExcelJS from 'exceljs';
import type { CskhBoardRow } from './cskh-board.types';
import type { CskhSlaTier } from './cskh-board-sla.util';

function tierState(row: CskhBoardRow, tier: CskhSlaTier): string {
  return row.sla_tiers.find((t) => t.tier === tier)?.sla_state ?? 'na';
}

export async function buildCskhBoardXlsx(rows: CskhBoardRow[]): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CSKH SLA');
  ws.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Tên', key: 'full_name', width: 22 },
    { header: 'SĐT', key: 'phone', width: 14 },
    { header: 'Trạng thái', key: 'status', width: 14 },
    { header: 'Nguồn', key: 'source', width: 12 },
    { header: 'Kênh', key: 'channel', width: 12 },
    { header: 'Owner', key: 'owner_name', width: 18 },
    { header: 'Nhận lead', key: 'received_at', width: 18 },
    { header: 'Gọi lần đầu', key: 'first_call_at', width: 18 },
    { header: 'Hoàn thành B2', key: 'b2_completed_at', width: 18 },
    { header: 'Chốt/Lost', key: 'closed_at', width: 18 },
    { header: 'SLA 15p', key: 'sla_15m', width: 10 },
    { header: 'SLA 4h', key: 'sla_4h', width: 10 },
    { header: 'SLA 24h', key: 'sla_24h', width: 10 },
    { header: 'Follow-up', key: 'next_follow_up_at', width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      status: row.status,
      source: row.source,
      channel: row.channel,
      owner_name: row.owner_name ?? row.owner_id ?? '',
      received_at: row.received_at,
      first_call_at: row.first_call_at ?? '',
      b2_completed_at: row.b2_completed_at ?? '',
      closed_at: row.closed_at ?? '',
      sla_15m: tierState(row, 'first_call_15m'),
      sla_4h: tierState(row, 'b2_complete_4h'),
      sla_24h: tierState(row, 'close_24h'),
      next_follow_up_at: row.next_follow_up_at ?? '',
    });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `cskh-board-${stamp}.xlsx` };
}
