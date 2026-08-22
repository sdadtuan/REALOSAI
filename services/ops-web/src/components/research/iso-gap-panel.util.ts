export const ISO_GAP_BANNER =
  'Gap-check nội bộ — không thay audit ISO 20252 và không chứng nhận đạt chuẩn.';

export type IsoGapStatus = 'pass' | 'partial' | 'fail' | 'na';

export type IsoGapPhase = 'planning' | 'execution' | 'supervision' | 'reporting';

export type IsoGapItem = {
  id: string;
  phase: IsoGapPhase;
  label_vi: string;
  status: IsoGapStatus;
  hint_vi?: string;
};

export type IsoGapSummary = {
  pass: number;
  partial: number;
  fail: number;
  na: number;
};

export const ISO_GAP_PHASE_LABELS: Record<IsoGapPhase, string> = {
  planning: 'Lên kế hoạch',
  execution: 'Thu thập & phân tích',
  supervision: 'Giám sát',
  reporting: 'Báo cáo',
};

export const ISO_GAP_STATUS_LABELS: Record<IsoGapStatus, string> = {
  pass: 'Đạt',
  partial: 'Một phần',
  fail: 'Thiếu',
  na: 'Không áp dụng',
};

export function isoGapStatusTone(status: IsoGapStatus): { bg: string; color: string } {
  switch (status) {
    case 'pass':
      return { bg: 'rgba(22, 163, 74, 0.12)', color: '#166534' };
    case 'partial':
      return { bg: 'rgba(180, 83, 9, 0.12)', color: '#92400e' };
    case 'fail':
      return { bg: 'rgba(220, 38, 38, 0.12)', color: '#991b1b' };
    default:
      return { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569' };
  }
}

export function groupIsoGapItemsByPhase(items: IsoGapItem[]): Record<IsoGapPhase, IsoGapItem[]> {
  const grouped: Record<IsoGapPhase, IsoGapItem[]> = {
    planning: [],
    execution: [],
    supervision: [],
    reporting: [],
  };
  for (const item of items) grouped[item.phase].push(item);
  return grouped;
}
