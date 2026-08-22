export type OpsReadiness = 'ready' | 'partial' | 'gap';

export type OpsRouteMapService = {
  code: string;
  name_vi: string;
  department?: string;
  package_tiers?: string[];
  readiness: OpsReadiness;
  service_slugs: {
    primary: string;
    alternates?: string[];
    existing_in_valid_slugs?: boolean;
  };
  depends_on_dv?: string[];
  ops_web?: {
    shell?: string[];
    execution?: Array<{ route: string; purpose?: string }>;
    tabs?: string[];
  };
  nest_api?: Record<string, unknown>;
  gaps?: string[];
};

export type OpsRouteMap = {
  schema_version: string;
  services: OpsRouteMapService[];
};

export type OpsServiceProfileRow = {
  id: number;
  dv_code: string;
  service_slug: string;
  name: string;
  readiness: OpsReadiness;
  service_slugs_json: Record<string, unknown>;
  ops_web_json: Record<string, unknown>;
  nest_api_json: Record<string, unknown>;
  weekly_process_template: unknown[];
  kpi_definitions: unknown[];
  tier_pricing: Record<string, unknown>;
};

export type OpsCatalogSku = {
  sku_code: string;
  tier: string;
  label_vi: string;
  pricing_model: Record<string, unknown>;
  status: string;
};

export type OpsCatalogItem = {
  dv_code: string;
  name: string;
  service_slug: string;
  readiness: OpsReadiness;
  package_tiers: string[];
  depends_on_dv?: string[];
  tier_pricing?: Record<string, unknown>;
  ops_web: Record<string, unknown>;
  skus?: OpsCatalogSku[];
};

export type OpsCatalogResponse = {
  schema_version: string;
  services: OpsCatalogItem[];
  spc_enabled?: boolean;
};

export type OpsHubEngine = {
  id: string;
  label: string;
  href: string;
  status: OpsReadiness | 'gap';
  badge: string | null;
};

export type OpsKpiMetricPayload = {
  key: string;
  label: string;
  unit?: string;
  actual: number | null;
  target: number | null;
  status_label?: 'Dat' | 'CanChuY' | 'KhongDat';
};

export type OpsWeeklyChecklistPayload = {
  id: number;
  template_task_id: string;
  title: string;
  owner_role: string;
  day_of_week: number | null;
  status: 'pending' | 'done' | 'skipped';
  kpi_key: string | null;
  completed_at: string | null;
};

export type OpsAlertPayload = {
  id: number;
  lifecycle_id: number;
  dv_code: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
};

export type OpsHubAlertsSnapshot = {
  open_count: number;
  items: OpsAlertPayload[];
};

export type OpsHubPayload = {
  lifecycle: {
    id: number;
    slug: string;
    client_name: string;
    status: string;
    stage?: string;
    package_tier: string;
  };
  dv: {
    dv_code: string;
    name: string;
    readiness: OpsReadiness;
  };
  engines: OpsHubEngine[];
  weekly: {
    iso_week: string;
    spawned: boolean;
    tasks_pending: number;
    tasks_done: number;
    items?: OpsWeeklyChecklistPayload[];
  };
  kpi: {
    period_type: 'week' | 'month';
    period_key: string;
    metrics: OpsKpiMetricPayload[];
  };
  alerts: OpsHubAlertsSnapshot;
  flags: {
    ops_dv_enabled: boolean;
    weekly_spawn_enabled: boolean;
    pilot_dv: boolean;
    ops_agent_enabled: boolean;
  };
};

export type OpsSpawnWeekResult = {
  iso_week: string;
  dv_code: string;
  sku_code?: string;
  phase_code?: string;
  task_source?: 'spc' | 'legacy';
  created: number;
  already_spawned: boolean;
  items: OpsWeeklyChecklistPayload[];
};

export type OpsKpiUpsertBody = {
  period_type?: 'week' | 'month';
  period_key?: string;
  metrics: Record<string, { actual?: number | null; target?: number | null }>;
};

export type OpsHubBuildContext = {
  lifecycleId: number;
  serviceSlug: string;
  status: string;
  stage?: string;
  clientName: string;
  packageTier: string;
  agencyClientId?: string;
};

export type OpsHubFlags = {
  opsDvEnabled: boolean;
  opsWeeklySpawnEnabled: boolean;
  opsHubPilotDv: Set<string>;
  opsAgentEnabled: boolean;
};
