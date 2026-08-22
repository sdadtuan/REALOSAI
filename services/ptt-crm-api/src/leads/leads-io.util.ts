import ExcelJS from 'exceljs';
import {
  LEAD_EXPORT_HEADERS,
  LEAD_IMPORT_ALIASES,
  LEAD_IMPORT_DEFAULTS,
  LEAD_IMPORT_HEADER_LABELS,
  LEAD_IMPORT_HEADERS,
} from './leads-io.constants';
import { CreateLeadV1Body, LeadV1 } from './leads.types';

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ');
}

function mapImportHeaders(headerRow: ExcelJS.CellValue[]): Partial<Record<(typeof LEAD_IMPORT_HEADERS)[number], number>> {
  const mapping: Partial<Record<(typeof LEAD_IMPORT_HEADERS)[number], number>> = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return;
    for (const key of LEAD_IMPORT_HEADERS) {
      if (mapping[key] != null) continue;
      const aliases = LEAD_IMPORT_ALIASES[key];
      if (aliases.some((alias) => normalized === normalizeHeader(alias))) {
        mapping[key] = index + 1;
      }
    }
  });
  return mapping;
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return '';
  const cell = row.getCell(col);
  const raw = cell.text ?? cell.value;
  if (raw == null) return '';
  return String(raw).trim();
}

export interface ParsedLeadImportRow {
  rowNumber: number;
  body: CreateLeadV1Body;
}

export interface LeadImportParseResult {
  rows: ParsedLeadImportRow[];
  errors: Array<{ row: number; message: string }>;
}

export async function buildLeadImportTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import Lead');
  ws.addRow(LEAD_IMPORT_HEADERS.map((key) => LEAD_IMPORT_HEADER_LABELS[key]));
  ws.addRow(['Nguyễn Văn A', '0901234567', 'lead@example.com', 'import', 'import', 'new', '']);
  ws.getRow(1).font = { bold: true };

  const guide = wb.addWorksheet('Huong dan');
  guide.addRow(['Cột', 'Bắt buộc', 'Ghi chú']);
  guide.addRow(['Họ tên *', 'Có', 'Không được trống']);
  guide.addRow(['SĐT / Email', 'Khuyến nghị', 'Ít nhất một trong hai']);
  guide.addRow(['Nguồn / Kênh', 'Không', `Mặc định ${LEAD_IMPORT_DEFAULTS.source}`]);
  guide.addRow(['Trạng thái', 'Không', `Mặc định ${LEAD_IMPORT_DEFAULTS.status}`]);
  guide.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildLeadsExportXlsx(
  leads: LeadV1[],
  meta?: { queryLabel?: string; exportedAt?: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sach Lead');
  if (meta?.queryLabel || meta?.exportedAt) {
    ws.addRow([`Xuất lead CRM · ${meta.exportedAt ?? new Date().toISOString().slice(0, 16).replace('T', ' ')}`]);
    if (meta.queryLabel) ws.addRow([meta.queryLabel]);
    ws.addRow([]);
  }
  const headerRow = ws.addRow([...LEAD_EXPORT_HEADERS]);
  headerRow.font = { bold: true };
  for (const lead of leads) {
    ws.addRow([
      lead.id,
      lead.full_name,
      lead.phone,
      lead.email,
      lead.status,
      lead.source,
      lead.channel,
      lead.owner_id ?? '',
      lead.created_at,
      lead.received_at,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function parseLeadImportXlsx(data: Buffer): Promise<LeadImportParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ row: 0, message: 'File Excel không có sheet dữ liệu' }] };
  }

  const headerRow = ws.getRow(1);
  const mapping = mapImportHeaders(headerRow.values as ExcelJS.CellValue[]);
  if (mapping.full_name == null) {
    return { rows: [], errors: [{ row: 1, message: 'Thiếu cột Họ tên (full_name)' }] };
  }

  const rows: ParsedLeadImportRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
    const row = ws.getRow(rowNumber);
    const fullName = cellText(row, mapping.full_name);
    const phone = cellText(row, mapping.phone);
    const email = cellText(row, mapping.email);
    const source = cellText(row, mapping.source) || LEAD_IMPORT_DEFAULTS.source;
    const channel = cellText(row, mapping.channel) || LEAD_IMPORT_DEFAULTS.channel;
    const status = cellText(row, mapping.status) || LEAD_IMPORT_DEFAULTS.status;
    const ownerRaw = cellText(row, mapping.owner_id);
    const ownerId = ownerRaw ? Number(ownerRaw) : null;

    if (!fullName && !phone && !email) continue;

    if (!fullName) {
      errors.push({ row: rowNumber, message: 'Thiếu họ tên' });
      continue;
    }
    if (ownerRaw && (!Number.isFinite(ownerId) || (ownerId ?? 0) <= 0)) {
      errors.push({ row: rowNumber, message: 'Owner ID không hợp lệ' });
      continue;
    }

    rows.push({
      rowNumber,
      body: {
        full_name: fullName,
        phone: phone || undefined,
        email: email || undefined,
        source,
        channel,
        status,
        owner_id: ownerId,
      },
    });
  }

  return { rows, errors };
}

export function exportFilename(prefix = 'leads-export'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.xlsx`;
}

export function templateFilename(): string {
  return 'lead-import-template.xlsx';
}
