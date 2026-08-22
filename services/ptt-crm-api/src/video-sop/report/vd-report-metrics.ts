export const VD_PRODUCTION_METRICS = [
  'kf_pass_rate',
  'clip_pass_rate',
  'takes_per_shot',
  'credit_ratio',
  'client_rounds',
  'lead_days',
  'override_rate',
] as const;

export type VdProductionMetric = (typeof VD_PRODUCTION_METRICS)[number];

export type VdKpiTarget = {
  label: string;
  direction: 'min' | 'max';
  threshold: number;
};

export const VD_KPI_TARGETS: Record<VdProductionMetric, VdKpiTarget> = {
  kf_pass_rate: { label: '≥60%', direction: 'min', threshold: 0.6 },
  clip_pass_rate: { label: '≥40%', direction: 'min', threshold: 0.4 },
  takes_per_shot: { label: '≤3', direction: 'max', threshold: 3 },
  credit_ratio: { label: '≤1.2', direction: 'max', threshold: 1.2 },
  client_rounds: { label: '≤2', direction: 'max', threshold: 2 },
  lead_days: { label: '≤3 ngày', direction: 'max', threshold: 3 },
  override_rate: { label: '≤5%', direction: 'max', threshold: 0.05 },
};

export function computeTakesPerShot(takeCount: number, shotCount: number): number {
  if (shotCount <= 0) return 0;
  return takeCount / shotCount;
}

export function computeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function computeCreditRatio(actual: number, estimated: number): number {
  if (estimated <= 0) return actual > 0 ? actual : 0;
  return actual / estimated;
}

export function computeLeadDays(createdAt: string, deliveredAt: string | null): number {
  if (!deliveredAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(deliveredAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}

export function kpiOnTrack(metric: VdProductionMetric, value: number): boolean {
  const target = VD_KPI_TARGETS[metric];
  if (target.direction === 'min') return value >= target.threshold;
  return value <= target.threshold;
}

export type VdProductionMetricRow = {
  metric: VdProductionMetric;
  value: number;
  target: VdKpiTarget;
  on_track: boolean;
};

export function buildMetricRows(values: Record<VdProductionMetric, number>): VdProductionMetricRow[] {
  return VD_PRODUCTION_METRICS.map((metric) => ({
    metric,
    value: values[metric],
    target: VD_KPI_TARGETS[metric],
    on_track: kpiOnTrack(metric, values[metric]),
  }));
}
