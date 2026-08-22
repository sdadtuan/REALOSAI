import type { MktAiDashboardPayload } from './marketing-ai-planner.types';

export type MktAiKpiAlertMetric = 'cpl' | 'roas';

export interface MktAiKpiDriftFinding {
  metric: MktAiKpiAlertMetric;
  delta_pct: number;
  alert_key: string;
  title: string;
  body: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildKpiAlertKey(
  lifecycleId: number,
  metric: MktAiKpiAlertMetric,
  weekStart: string,
): string {
  return `mkt_ai_kpi:${lifecycleId}:${metric}:${weekStart}`;
}

export function resolveAlertWeekStart(dashboard: MktAiDashboardPayload): string {
  const trend = dashboard.trend;
  if (trend.length) return trend[trend.length - 1].week_start;
  return dashboard.period.to;
}

export function buildKpiAlertDashboardLink(lifecycleId: number): string {
  return `/crm/service-delivery/${lifecycleId}?tab=ai-planner&step=dashboard&sub=dashboard`;
}

export function isCplDrift(deltaPct: number | null, thresholdPct: number): boolean {
  return deltaPct != null && deltaPct >= thresholdPct;
}

export function computeRoasWeekDropPct(
  trend: MktAiDashboardPayload['trend'],
): { drop_pct: number; roas_stub: boolean } | null {
  if (trend.length < 2) return null;
  const prev = trend[trend.length - 2];
  const curr = trend[trend.length - 1];
  if (prev.roas == null || curr.roas == null || prev.roas <= 0) return null;
  const dropPct = ((prev.roas - curr.roas) / prev.roas) * 100;
  if (dropPct <= 0) return null;
  return { drop_pct: round2(dropPct), roas_stub: curr.roas_stub };
}

export function isRoasDrift(dropPct: number | null, thresholdPct: number): boolean {
  return dropPct != null && dropPct >= thresholdPct;
}

export function detectKpiDrifts(input: {
  lifecycleId: number;
  brandLabel: string;
  dashboard: MktAiDashboardPayload;
  cplThresholdPct: number;
  roasThresholdPct: number;
}): MktAiKpiDriftFinding[] {
  const { lifecycleId, brandLabel, dashboard, cplThresholdPct, roasThresholdPct } = input;
  const weekStart = resolveAlertWeekStart(dashboard);
  const brand = brandLabel.trim() || `Lifecycle #${lifecycleId}`;
  const findings: MktAiKpiDriftFinding[] = [];

  const cplDelta = dashboard.deltas.cpl_vs_target_pct;
  if (isCplDrift(cplDelta, cplThresholdPct)) {
    findings.push({
      metric: 'cpl',
      delta_pct: cplDelta!,
      alert_key: buildKpiAlertKey(lifecycleId, 'cpl', weekStart),
      title: `CPL Meta vượt ngưỡng — ${brand}`,
      body: `CPL tuần này +${cplDelta}% so target. Mở AI Planner Dashboard.`,
    });
  }

  const roasDrop = computeRoasWeekDropPct(dashboard.trend);
  if (roasDrop && isRoasDrift(roasDrop.drop_pct, roasThresholdPct)) {
    const stubNote = roasDrop.roas_stub ? ' (ROAS ước tính)' : '';
    findings.push({
      metric: 'roas',
      delta_pct: round2(-roasDrop.drop_pct),
      alert_key: buildKpiAlertKey(lifecycleId, 'roas', weekStart),
      title: `ROAS Meta giảm mạnh — ${brand}`,
      body: `ROAS tuần này −${roasDrop.drop_pct}% so tuần trước${stubNote}. Mở AI Planner Dashboard.`,
    });
  }

  return findings;
}
