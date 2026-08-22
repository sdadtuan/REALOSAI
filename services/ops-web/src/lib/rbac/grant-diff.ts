export const PERMISSION_MATRIX_ACTIONS = [
  'view',
  'edit',
  'create',
  'delete',
  'export',
  'configure',
  'approve',
  'claim',
  'release',
  'write',
  'settings',
  'compliance',
  'deliverability',
  'reports',
  'assign',
] as const;

export type PermissionMatrixAction = (typeof PERMISSION_MATRIX_ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: 'Xem',
  edit: 'Sửa',
  create: 'Tạo',
  delete: 'Xóa',
  export: 'Xuất',
  configure: 'Cấu hình',
  approve: 'Duyệt',
  claim: 'Nhận case',
  release: 'Trả Sales',
  write: 'Ghi',
  settings: 'Cài đặt',
  compliance: 'Tuân thủ',
  deliverability: 'Deliverability',
  reports: 'Báo cáo',
  assign: 'Phân công',
};

export function permissionActionLabel(action: string): string {
  return PERMISSION_ACTION_LABELS[action] ?? action;
}

export function computeGrantDiff(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  const sections = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const section of sections) {
    const prev = new Set(before[section] ?? []);
    const next = new Set(after[section] ?? []);
    for (const action of next) {
      if (!prev.has(action)) added += 1;
    }
    for (const action of prev) {
      if (!next.has(action)) removed += 1;
    }
  }
  return { added, removed };
}
