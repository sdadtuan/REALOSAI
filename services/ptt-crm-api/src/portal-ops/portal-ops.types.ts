export type OpsPortalKpiLabel = 'Dat' | 'CanChuY' | 'KhongDat';

export type OpsPortalLinkedLifecycle = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number | null;
  service_slug: string | null;
  dv_code: string | null;
  stage: string | null;
};

export type OpsPortalMetric = {
  key: string;
  label: string;
  status_label: OpsPortalKpiLabel;
  progress_pct: number | null;
};

export type OpsPortalSummary = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  dv_code: string;
  dv_name: string;
  stage: string;
  package_tier: string;
  iso_week: string;
  weekly: {
    spawned: boolean;
    tasks_done: number;
    tasks_total: number;
    progress_pct: number;
  };
  kpi: {
    period_type: 'month';
    period_key: string;
    overall_label: OpsPortalKpiLabel | null;
    metrics: OpsPortalMetric[];
  };
  status_message_vi: string;
};
