/** P0-2 — Lead import/export Excel column definitions */

export const LEAD_EXPORT_HEADERS = [
  'ID',
  'Họ tên',
  'SĐT',
  'Email',
  'Trạng thái',
  'Nguồn',
  'Kênh',
  'Owner ID',
  'Ngày tạo',
  'Ngày nhận',
] as const;

export const LEAD_IMPORT_HEADERS = [
  'full_name',
  'phone',
  'email',
  'source',
  'channel',
  'status',
  'owner_id',
] as const;

export const LEAD_IMPORT_HEADER_LABELS: Record<(typeof LEAD_IMPORT_HEADERS)[number], string> = {
  full_name: 'Họ tên *',
  phone: 'SĐT',
  email: 'Email',
  source: 'Nguồn',
  channel: 'Kênh',
  status: 'Trạng thái',
  owner_id: 'Owner ID',
};

export const LEAD_IMPORT_ALIASES: Record<(typeof LEAD_IMPORT_HEADERS)[number], string[]> = {
  full_name: ['full_name', 'ho ten', 'họ tên', 'ten', 'họ tên *', 'name'],
  phone: ['phone', 'sdt', 'sđt', 'dien thoai', 'điện thoại'],
  email: ['email', 'e-mail'],
  source: ['source', 'nguon', 'nguồn'],
  channel: ['channel', 'kenh', 'kênh'],
  status: ['status', 'trang thai', 'trạng thái'],
  owner_id: ['owner_id', 'owner id', 'owner'],
};

export const LEAD_IMPORT_DEFAULTS = {
  source: 'import',
  channel: 'import',
  status: 'new',
} as const;

export const LEAD_IO_MAX_EXPORT = 5000;
export const LEAD_IO_MAX_IMPORT_ROWS = 500;
