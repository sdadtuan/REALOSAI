export type OpsKpiStatusLabel = 'Dat' | 'CanChuY' | 'KhongDat';

export const OPS_KPI_LABEL_VI: Record<OpsKpiStatusLabel, string> = {
  Dat: 'Đạt',
  CanChuY: 'Cần chú ý',
  KhongDat: 'Không đạt',
};

/** BR-OPS-KPI-01 — percent of target thresholds. */
export function kpiStatusLabel(actual: number, target: number): OpsKpiStatusLabel {
  if (!Number.isFinite(actual)) return 'KhongDat';
  if (!Number.isFinite(target) || target <= 0) return 'Dat';
  const pct = (actual / target) * 100;
  if (pct >= 100) return 'Dat';
  if (pct >= 70) return 'CanChuY';
  return 'KhongDat';
}

export type OpsKpiMetricInput = {
  key: string;
  label: string;
  unit?: string;
  actual?: number | null;
  target?: number | null;
  status_label?: OpsKpiStatusLabel;
};

export type OpsKpiDefinition = {
  key: string;
  label: string;
  unit?: string;
  target?: number;
  target_by_tier?: Record<string, number>;
};

export function resolveKpiTarget(
  def: OpsKpiDefinition,
  packageTier: string,
): number | null {
  const tier = String(packageTier ?? 'standard').trim().toLowerCase();
  if (def.target_by_tier && def.target_by_tier[tier] != null) {
    return Number(def.target_by_tier[tier]);
  }
  if (def.target != null) return Number(def.target);
  return null;
}

export function computeMetricLabels(
  metrics: Record<string, { actual?: number | null; target?: number | null; label?: string; unit?: string }>,
  definitions: OpsKpiDefinition[],
  packageTier: string,
): OpsKpiMetricInput[] {
  const defByKey = new Map(definitions.map((d) => [d.key, d]));
  const keys = new Set([...Object.keys(metrics), ...definitions.map((d) => d.key)]);

  return [...keys].map((key) => {
    const def = defByKey.get(key);
    const raw = metrics[key] ?? {};
    const target =
      raw.target != null && Number.isFinite(Number(raw.target))
        ? Number(raw.target)
        : def
          ? resolveKpiTarget(def, packageTier)
          : null;
    const actual =
      raw.actual != null && Number.isFinite(Number(raw.actual)) ? Number(raw.actual) : null;
    const status =
      actual != null && target != null
        ? kpiStatusLabel(actual, target)
        : ('CanChuY' as OpsKpiStatusLabel);
    return {
      key,
      label: String(raw.label ?? def?.label ?? key),
      unit: raw.unit ?? def?.unit,
      actual,
      target,
      status_label: actual != null && target != null ? status : undefined,
    };
  });
}
