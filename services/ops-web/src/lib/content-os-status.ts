import type { ContentOsItem } from '@/lib/content-os-api';

export type ContentOsSubView =
  | 'overview'
  | 'ideas'
  | 'pillars'
  | 'board'
  | 'review'
  | 'calendar'
  | 'repurpose'
  | 'audit'
  | 'intelligence';

export const CMKT_SUB_VIEWS: ContentOsSubView[] = [
  'overview',
  'ideas',
  'pillars',
  'board',
  'review',
  'calendar',
  'repurpose',
  'audit',
  'intelligence',
];

export function isContentOsSubView(value: string | null): value is ContentOsSubView {
  return value != null && (CMKT_SUB_VIEWS as string[]).includes(value);
}

const APPROVED_COPY_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'published',
  'client_approved',
]);

export function itemNeedsVisualApproval(item: ContentOsItem): boolean {
  if (item.format === 'carousel' || item.format === 'video_script') return true;
  return item.brief_json?.needs_visual === true;
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_review':
      return 'Đang duyệt';
    case 'approved_internal':
      return 'Đã duyệt';
    case 'pending_client':
      return 'Chờ KH duyệt';
    case 'client_approved':
      return 'KH đã duyệt';
    case 'scheduled':
      return 'Đã lên lịch';
    case 'published':
      return 'Published';
    case 'changes_requested':
      return 'Cần sửa';
    default:
      return status;
  }
}

export function statusAccentColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'var(--muted, #888)';
    case 'in_review':
      return 'var(--warning, #e6a700)';
    case 'approved_internal':
      return 'var(--accent)';
    case 'pending_client':
      return 'var(--warning, #e6a700)';
    case 'client_approved':
      return '#8bc34a';
    case 'scheduled':
      return '#6b9bd1';
    case 'published':
      return 'var(--success, #2ecc71)';
    case 'changes_requested':
      return 'var(--danger, #e74c3c)';
    default:
      return 'var(--border)';
  }
}

export type DualGateChips = {
  show: boolean;
  textOk: boolean;
  visualOk: boolean;
};

export function boardColumns(clientGate: boolean): readonly string[] {
  if (!clientGate) {
    return ['draft', 'in_review', 'approved_internal', 'scheduled', 'published'];
  }
  return [
    'draft',
    'in_review',
    'approved_internal',
    'pending_client',
    'client_approved',
    'scheduled',
    'published',
  ];
}

export function dualGateChips(item: ContentOsItem): DualGateChips {
  if (!itemNeedsVisualApproval(item)) {
    return { show: false, textOk: false, visualOk: false };
  }
  const textOk = APPROVED_COPY_STATUSES.has(item.status);
  const visualOk = item.visual_status === 'approved';
  return { show: true, textOk, visualOk };
}
