import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export class OpsApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
  ) {
    super(message, status);
    this.name = 'OpsApiError';
  }
}

export type OpsHubEngine = {
  id: string;
  label: string;
  href: string;
  status: string;
  badge: string | null;
};

export type OpsKpiMetric = {
  key: string;
  label: string;
  unit?: string;
  actual: number | null;
  target: number | null;
  status_label?: 'Dat' | 'CanChuY' | 'KhongDat';
};

export type OpsWeeklyChecklistItem = {
  id: number;
  template_task_id: string;
  title: string;
  owner_role: string;
  day_of_week: number | null;
  status: 'pending' | 'done' | 'skipped';
  kpi_key: string | null;
  completed_at: string | null;
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
    readiness: string;
  };
  engines: OpsHubEngine[];
  weekly: {
    iso_week: string;
    spawned: boolean;
    tasks_pending: number;
    tasks_done: number;
    items?: OpsWeeklyChecklistItem[];
  };
  kpi: {
    period_type: 'week' | 'month';
    period_key: string;
    metrics: OpsKpiMetric[];
  };
  flags: {
    ops_dv_enabled: boolean;
    weekly_spawn_enabled: boolean;
    pilot_dv: boolean;
    ops_agent_enabled: boolean;
  };
  alerts: {
    open_count: number;
    items: OpsAlertItem[];
  };
};

export type OpsAlertItem = {
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

export type OpsDashboardInstance = {
  lifecycle_id: number;
  client_name: string;
  dv_code: string;
  dv_name: string;
  package_tier: string;
  stage: string;
  kpi_label: 'Dat' | 'CanChuY' | 'KhongDat' | null;
  tasks_done_pct: number;
  alerts_open: number;
  department?: string;
};

export type OpsDashboardAmPayload = {
  role: 'am';
  instances: OpsDashboardInstance[];
  summary: { total: number; alerts_open: number; kpi_dat_pct: number };
};

export type OpsDashboardTeamLeadPayload = {
  role: 'team_lead';
  departments: Array<{
    department: string;
    instances: OpsDashboardInstance[];
    alerts_open: number;
  }>;
};

export type OpsDashboardSpecialistPayload = {
  role: 'specialist';
  tasks: Array<{
    checklist_item_id: number;
    lifecycle_id: number;
    dv_code: string;
    title: string;
    owner_role: string;
    status: string;
    iso_week: string;
  }>;
  summary: { pending: number; done: number };
};

export type OpsDashboardExecutivePayload = {
  role: 'executive';
  summary: {
    active_instances: number;
    kpi_dat_pct: number;
    alerts_open: number;
    pilot_dv_count: number;
  };
  by_dv: Array<{ dv_code: string; name: string; instances: number; alerts_open: number }>;
};

export type OpsCatalogService = {
  dv_code: string;
  name: string;
  service_slug: string;
  readiness: 'ready' | 'partial' | 'gap' | string;
  package_tiers?: string[];
  depends_on_dv?: string[];
  tier_pricing?: Record<string, unknown>;
  ops_web?: Record<string, unknown>;
  skus?: Array<{
    sku_code: string;
    tier: string;
    label_vi: string;
    pricing_model: Record<string, unknown>;
    status: string;
  }>;
};

export type OpsCatalogResponse = {
  schema_version: string;
  services: OpsCatalogService[];
  spc_enabled?: boolean;
};

export type OpsSpawnWeekResult = {
  iso_week: string;
  dv_code: string;
  sku_code?: string;
  phase_code?: string;
  task_source?: 'spc' | 'legacy';
  created: number;
  already_spawned: boolean;
  items: OpsWeeklyChecklistItem[];
};

async function opsFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeaders(token) as Record<string, string>),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new OpsApiError(
      body.message ?? body.error ?? 'Ops request failed',
      res.status,
      body.error,
    );
  }
  return body;
}

export async function fetchOpsHub(token: string, lifecycleId: number): Promise<OpsHubPayload> {
  return opsFetch<OpsHubPayload>(token, `/api/ops/lifecycle/${lifecycleId}/hub`);
}

export async function fetchOpsCatalog(token: string): Promise<OpsCatalogResponse> {
  return opsFetch<OpsCatalogResponse>(token, '/api/ops/catalog');
}

export async function spawnOpsWeek(token: string, lifecycleId: number): Promise<OpsSpawnWeekResult> {
  return opsFetch<OpsSpawnWeekResult>(token, `/api/ops/lifecycle/${lifecycleId}/spawn-week`, {
    method: 'POST',
  });
}

export async function patchOpsWeeklyItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  status: 'pending' | 'done' | 'skipped',
): Promise<OpsWeeklyChecklistItem> {
  return opsFetch<OpsWeeklyChecklistItem>(
    token,
    `/api/ops/lifecycle/${lifecycleId}/weekly/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export async function putOpsKpi(
  token: string,
  lifecycleId: number,
  body: {
    period_type?: 'week' | 'month';
    period_key?: string;
    metrics: Record<string, { actual?: number | null; target?: number | null }>;
  },
): Promise<{ metrics: OpsKpiMetric[] }> {
  return opsFetch(token, `/api/ops/lifecycle/${lifecycleId}/kpi`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function fetchOpsAlerts(
  token: string,
  query?: { lifecycle_id?: number; status?: 'open' | 'acknowledged'; limit?: number },
): Promise<{ items: OpsAlertItem[]; total: number }> {
  const params = new URLSearchParams();
  if (query?.lifecycle_id) params.set('lifecycle_id', String(query.lifecycle_id));
  if (query?.status) params.set('status', query.status);
  if (query?.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return opsFetch(token, `/api/ops/alerts${qs ? `?${qs}` : ''}`);
}

export async function acknowledgeOpsAlert(token: string, alertId: number): Promise<OpsAlertItem> {
  return opsFetch<OpsAlertItem>(token, `/api/ops/alerts/${alertId}/ack`, { method: 'PATCH' });
}

export async function fetchOpsAgentStatus(token: string): Promise<Record<string, unknown>> {
  return opsFetch(token, '/api/ops/agent/status');
}

export async function runOpsAgentScan(
  token: string,
  dryRun = false,
): Promise<Record<string, unknown>> {
  return opsFetch(token, '/api/ops/agent/run', {
    method: 'POST',
    body: JSON.stringify({ dry_run: dryRun }),
  });
}

export async function fetchOpsDashboardAm(token: string, amId?: string): Promise<OpsDashboardAmPayload> {
  const qs = amId ? `?am_id=${encodeURIComponent(amId)}` : '';
  return opsFetch(token, `/api/ops/dashboard/am${qs}`);
}

export async function fetchOpsDashboardTeamLead(
  token: string,
  department?: string,
): Promise<OpsDashboardTeamLeadPayload> {
  const qs = department ? `?department=${encodeURIComponent(department)}` : '';
  return opsFetch(token, `/api/ops/dashboard/team-lead${qs}`);
}

export async function fetchOpsDashboardSpecialist(token: string): Promise<OpsDashboardSpecialistPayload> {
  return opsFetch(token, '/api/ops/dashboard/specialist');
}

export async function fetchOpsDashboardExecutive(token: string): Promise<OpsDashboardExecutivePayload> {
  return opsFetch(token, '/api/ops/dashboard/executive');
}

export function parseOpsHubError(err: unknown): string {
  if (err instanceof OpsApiError) {
    switch (err.code) {
      case 'ops_dv_disabled':
        return 'Ops Hub chưa bật trên server (PTT_OPS_DV_ENABLED).';
      case 'unknown_service_slug':
        return 'Slug dịch vụ chưa map DV — liên hệ admin.';
      case 'dv_not_found':
        return 'Không tìm thấy profile DV.';
      case 'weekly_spawn_disabled':
        return 'Spawn tuần chưa bật (PTT_OPS_WEEKLY_SPAWN).';
      case 'lifecycle_not_active':
        return 'Lifecycle chưa active — không thể sinh checklist.';
      case 'lifecycle_stage_not_delivering':
        return 'Lifecycle chưa vào giai đoạn triển khai (onboard/deliver).';
      case 'empty_weekly_template':
        return 'DV chưa có weekly template — chạy seed pilot.';
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Tải Ops Hub thất bại';
}
