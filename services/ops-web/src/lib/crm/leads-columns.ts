export type LeadsColumnId =
  | 'id'
  | 'name'
  | 'phone'
  | 'status'
  | 'kind'
  | 'project'
  | 'ai_band'
  | 'sla'
  | 'in_call'
  | 'source'
  | 'channel'
  | 'score'
  | 'date';

export const LEADS_COLUMNS_STORAGE_KEY = 'crm.leads.columns.v1';

export const LEADS_COLUMN_DEFS: Array<{
  id: LeadsColumnId;
  label: string;
  defaultVisible: boolean;
  scoreOnly?: boolean;
}> = [
  { id: 'id', label: 'ID', defaultVisible: true },
  { id: 'name', label: 'Tên', defaultVisible: true },
  { id: 'phone', label: 'SĐT', defaultVisible: true },
  { id: 'status', label: 'Trạng thái', defaultVisible: true },
  { id: 'kind', label: 'Loại', defaultVisible: true },
  { id: 'project', label: 'Dự án', defaultVisible: true },
  { id: 'ai_band', label: 'AI band', defaultVisible: false },
  { id: 'sla', label: 'SLA', defaultVisible: false },
  { id: 'in_call', label: 'Đang gọi', defaultVisible: false },
  { id: 'source', label: 'Nguồn', defaultVisible: true },
  { id: 'channel', label: 'Kênh', defaultVisible: true },
  { id: 'score', label: 'AI Score', defaultVisible: true, scoreOnly: true },
  { id: 'date', label: 'Ngày', defaultVisible: true },
];

export function defaultLeadsVisibleColumns(showScores: boolean): Set<LeadsColumnId> {
  return new Set(
    LEADS_COLUMN_DEFS.filter((col) => col.defaultVisible && (!col.scoreOnly || showScores)).map(
      (col) => col.id,
    ),
  );
}

export function defaultB2bLeadsVisibleColumns(): Set<LeadsColumnId> {
  return new Set([
    'id',
    'name',
    'phone',
    'status',
    'project',
    'ai_band',
    'sla',
    'in_call',
    'date',
  ]);
}

export function readLeadsVisibleColumns(showScores: boolean): Set<LeadsColumnId> {
  if (typeof window === 'undefined') return defaultLeadsVisibleColumns(showScores);
  try {
    const raw = window.localStorage.getItem(LEADS_COLUMNS_STORAGE_KEY);
    if (!raw) return defaultLeadsVisibleColumns(showScores);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultLeadsVisibleColumns(showScores);
    const allowed = new Set(LEADS_COLUMN_DEFS.map((c) => c.id));
    const cols = parsed.filter((id): id is LeadsColumnId => typeof id === 'string' && allowed.has(id as LeadsColumnId));
    if (cols.length === 0) return defaultLeadsVisibleColumns(showScores);
    const set = new Set(cols);
    if (!showScores) set.delete('score');
    return set;
  } catch {
    return defaultLeadsVisibleColumns(showScores);
  }
}

export function writeLeadsVisibleColumns(columns: Set<LeadsColumnId>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEADS_COLUMNS_STORAGE_KEY, JSON.stringify([...columns]));
}
