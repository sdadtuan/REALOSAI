/** Vietnamese labels for quality criteria (mirrors marketing-ai-quality.util.ts). */
export const QUALITY_CRITERIA_LABELS: Record<string, string> = {
  brief_complete: 'Brief đầy đủ',
  icp_clarity: 'ICP rõ ràng (≥80 ký tự)',
  budget_realistic: 'Ngân sách hợp lý',
  kpi_defined: 'KPI chiến dịch',
  channel_mix: 'Mix kênh (≥2 kênh)',
  risk_competitor: 'Rủi ro / đối thủ',
  kpi_tree_complete: 'KPI tree North Star → campaign',
};

export const QUALITY_CRITERIA_ORDER = [
  'brief_complete',
  'icp_clarity',
  'budget_realistic',
  'kpi_defined',
  'channel_mix',
  'risk_competitor',
  'kpi_tree_complete',
] as const;

export type QualityTier = 'blocked' | 'conditional' | 'ready';

export function getQualityTier(score: number | undefined | null): QualityTier {
  if (score == null || score < 60) return 'blocked';
  if (score < 70) return 'conditional';
  return 'ready';
}

export function qualityTierLabel(tier: QualityTier): string {
  switch (tier) {
    case 'ready':
      return 'Đủ điều kiện apply & export đầy đủ';
    case 'conditional':
      return 'Apply được — nên review kỹ (60–69). Export chỉ DOCX.';
    case 'blocked':
      return 'Chưa đủ điều kiện apply (cần ≥60)';
  }
}

export function qualityScoreColor(score: number | undefined | null): string {
  const tier = getQualityTier(score);
  if (tier === 'ready') return 'var(--accent, #398b43)';
  if (tier === 'conditional') return '#c9920a';
  return 'var(--error, #c0392b)';
}

export function canExportFormat(
  format: 'pdf' | 'docx' | 'xlsx' | 'pptx',
  score: number | undefined | null,
): boolean {
  if (score == null || score < 60) return false;
  if (score < 70) return format === 'docx';
  return true;
}

export function countCriteriaPassed(criteria: Record<string, boolean> | undefined): number {
  if (!criteria) return 0;
  return Object.values(criteria).filter(Boolean).length;
}
