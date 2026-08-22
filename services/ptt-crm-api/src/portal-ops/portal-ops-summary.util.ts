import type { OpsPortalKpiLabel, OpsPortalMetric, OpsPortalSummary } from './portal-ops.types';

export function kpiLabelVi(label: OpsPortalKpiLabel | null): string {
  if (label === 'Dat') return 'Đạt';
  if (label === 'CanChuY') return 'Cần chú ý';
  if (label === 'KhongDat') return 'Không đạt';
  return 'Đang cập nhật';
}

export function worstPortalKpiLabel(
  metrics: Array<{ status_label?: OpsPortalKpiLabel }>,
): OpsPortalKpiLabel | null {
  if (metrics.some((m) => m.status_label === 'KhongDat')) return 'KhongDat';
  if (metrics.some((m) => m.status_label === 'CanChuY')) return 'CanChuY';
  if (metrics.some((m) => m.status_label === 'Dat')) return 'Dat';
  return null;
}

export function metricProgressPct(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target <= 0) return null;
  return Math.min(100, Math.round((actual / target) * 100));
}

export function buildPortalStatusMessageVi(input: {
  overallLabel: OpsPortalKpiLabel | null;
  weeklySpawned: boolean;
  weeklyProgressPct: number;
}): string {
  if (!input.weeklySpawned) {
    return 'Team PTT đang chuẩn bị checklist tuần — quay lại sau.';
  }
  if (input.overallLabel === 'Dat') {
    return `Tiến độ tuần ${input.weeklyProgressPct}% · KPI tháng đạt mục tiêu.`;
  }
  if (input.overallLabel === 'CanChuY') {
    return `Tiến độ tuần ${input.weeklyProgressPct}% · một số KPI cần theo dõi — AM/SP đang xử lý.`;
  }
  if (input.overallLabel === 'KhongDat') {
    return `Tiến độ tuần ${input.weeklyProgressPct}% · có KPI chưa đạt — AM sẽ liên hệ trao đổi.`;
  }
  return `Tiến độ tuần ${input.weeklyProgressPct}% · team đang cập nhật KPI tháng.`;
}

export function buildPortalOpsSummary(input: {
  lifecycleId: number;
  serviceSlug: string;
  dvCode: string;
  dvName: string;
  stage: string;
  packageTier: string;
  isoWeek: string;
  weeklySpawned: boolean;
  tasksDone: number;
  tasksPending: number;
  periodKey: string;
  metrics: OpsPortalMetric[];
  overallLabel: OpsPortalKpiLabel | null;
}): OpsPortalSummary {
  const tasksTotal = input.tasksDone + input.tasksPending;
  const weeklyProgressPct =
    tasksTotal > 0 ? Math.round((input.tasksDone / tasksTotal) * 100) : 0;

  return {
    ok: true,
    enabled: true,
    lifecycle_id: input.lifecycleId,
    service_slug: input.serviceSlug,
    dv_code: input.dvCode,
    dv_name: input.dvName,
    stage: input.stage,
    package_tier: input.packageTier,
    iso_week: input.isoWeek,
    weekly: {
      spawned: input.weeklySpawned,
      tasks_done: input.tasksDone,
      tasks_total: tasksTotal,
      progress_pct: weeklyProgressPct,
    },
    kpi: {
      period_type: 'month',
      period_key: input.periodKey,
      overall_label: input.overallLabel,
      metrics: input.metrics,
    },
    status_message_vi: buildPortalStatusMessageVi({
      overallLabel: input.overallLabel,
      weeklySpawned: input.weeklySpawned,
      weeklyProgressPct,
    }),
  };
}
