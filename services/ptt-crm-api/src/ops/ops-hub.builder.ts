import type {
  OpsHubAlertsSnapshot,
  OpsHubBuildContext,
  OpsHubEngine,
  OpsHubFlags,
  OpsHubPayload,
  OpsKpiMetricPayload,
  OpsReadiness,
  OpsRouteMapService,
  OpsServiceProfileRow,
  OpsWeeklyChecklistPayload,
} from './ops.types';

export function currentIsoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function currentMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function buildEngineHref(
  template: string,
  ctx: Pick<OpsHubBuildContext, 'lifecycleId' | 'agencyClientId'>,
): string {
  let href = String(template ?? '').trim();
  if (!href) return '#';
  href = href.replace(/\{lifecycleId\}/g, String(ctx.lifecycleId));
  href = href.replace(/:lifecycleId/g, String(ctx.lifecycleId));
  if (ctx.agencyClientId) {
    href = href.replace(/\{clientId\}/g, ctx.agencyClientId);
    href = href.replace(/:clientId/g, ctx.agencyClientId);
  }
  return href;
}

function engineStatus(readiness: OpsReadiness): OpsReadiness | 'gap' {
  return readiness === 'gap' ? 'gap' : readiness;
}

export function buildOpsHubPayload(input: {
  ctx: OpsHubBuildContext;
  dv: OpsRouteMapService;
  profile: OpsServiceProfileRow | null;
  flags: OpsHubFlags;
  weeklySnapshot?: {
    spawned: boolean;
    tasks_pending: number;
    tasks_done: number;
    items?: OpsWeeklyChecklistPayload[];
  };
  kpiSnapshot?: {
    period_type: 'week' | 'month';
    period_key: string;
    metrics: OpsKpiMetricPayload[];
  };
  alertsSnapshot?: OpsHubAlertsSnapshot;
}): OpsHubPayload {
  const { ctx, dv, profile, flags, weeklySnapshot, kpiSnapshot, alertsSnapshot } = input;
  const opsWeb = (profile?.ops_web_json ?? dv.ops_web ?? {}) as {
    execution?: Array<{ route: string; purpose?: string }>;
  };
  const executions = opsWeb.execution ?? [];
  const readiness = dv.readiness;

  const engines: OpsHubEngine[] = executions.map((ex, index) => {
    const disabled = readiness === 'gap';
    const route = String(ex.route ?? '');
    const label = String(ex.purpose ?? route).trim() || route;
    return {
      id: `engine-${index}`,
      label,
      href: buildEngineHref(route, ctx),
      status: disabled ? 'gap' : engineStatus(readiness),
      badge: disabled ? 'Manual' : readiness === 'partial' ? 'Partial' : null,
    };
  });

  if (engines.length === 0 && readiness !== 'gap') {
    engines.push({
      id: 'service-delivery',
      label: 'Service delivery',
      href: `/crm/service-delivery/${ctx.lifecycleId}`,
      status: readiness,
      badge: null,
    });
  }

  return {
    lifecycle: {
      id: ctx.lifecycleId,
      slug: ctx.serviceSlug,
      client_name: ctx.clientName,
      status: ctx.status,
      stage: ctx.stage,
      package_tier: ctx.packageTier,
    },
    dv: {
      dv_code: dv.code,
      name: dv.name_vi,
      readiness: dv.readiness,
    },
    engines,
    weekly: {
      iso_week: currentIsoWeek(),
      spawned: weeklySnapshot?.spawned ?? false,
      tasks_pending: weeklySnapshot?.tasks_pending ?? 0,
      tasks_done: weeklySnapshot?.tasks_done ?? 0,
      items: weeklySnapshot?.items,
    },
    kpi: kpiSnapshot ?? {
      period_type: 'month',
      period_key: currentMonthKey(),
      metrics: [],
    },
    alerts: alertsSnapshot ?? { open_count: 0, items: [] },
    flags: {
      ops_dv_enabled: flags.opsDvEnabled,
      weekly_spawn_enabled: flags.opsWeeklySpawnEnabled,
      pilot_dv: flags.opsHubPilotDv.has(dv.code),
      ops_agent_enabled: flags.opsAgentEnabled,
    },
  };
}
