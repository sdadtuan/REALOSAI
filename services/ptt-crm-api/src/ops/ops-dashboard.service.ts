import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { currentIsoWeek, currentMonthKey } from './ops-hub.builder';
import { computeMetricLabels, type OpsKpiDefinition } from './ops-kpi-label.util';
import { OpsAlertPgRepository } from './ops-alert-pg.repository';
import type {
  OpsDashboardAmPayload,
  OpsDashboardExecutivePayload,
  OpsDashboardInstance,
  OpsDashboardSpecialistPayload,
  OpsDashboardTeamLeadPayload,
} from './ops-alert.types';
import { OpsKpiPgRepository } from './ops-kpi-pg.repository';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { resolveDvByLifecycleSlug } from './ops-slug-resolver.util';
import { OpsWeeklyPgRepository } from './ops-weekly-pg.repository';

@Injectable()
export class OpsDashboardService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly alerts: OpsAlertPgRepository,
    private readonly weekly: OpsWeeklyPgRepository,
    private readonly kpi: OpsKpiPgRepository,
    private readonly profiles: OpsProfilePgRepository,
  ) {}

  private assertEnabled(): void {
    if (!this.config.opsDvEnabled) {
      throw new Error('ops_dv_disabled');
    }
  }

  private parseKpiDefinitions(raw: unknown): OpsKpiDefinition[] {
    if (!Array.isArray(raw)) return [];
    const out: OpsKpiDefinition[] = [];
    for (const item of raw) {
      const row = item as Record<string, unknown>;
      const key = String(row.key ?? '').trim();
      if (!key) continue;
      out.push({
        key,
        label: String(row.label ?? key),
        unit: row.unit != null ? String(row.unit) : undefined,
        target: row.target != null ? Number(row.target) : undefined,
        target_by_tier: row.target_by_tier as Record<string, number> | undefined,
      });
    }
    return out;
  }

  private worstKpiLabel(
    metrics: ReturnType<typeof computeMetricLabels>,
  ): OpsDashboardInstance['kpi_label'] {
    if (metrics.some((m) => m.status_label === 'KhongDat')) return 'KhongDat';
    if (metrics.some((m) => m.status_label === 'CanChuY')) return 'CanChuY';
    if (metrics.some((m) => m.status_label === 'Dat')) return 'Dat';
    return null;
  }

  private async buildInstanceRow(lc: {
    id: number;
    service_slug: string;
    stage: string;
    customer_id: number | null;
  }): Promise<OpsDashboardInstance | null> {
    const map = this.routeMap.getMap();
    const dv = resolveDvByLifecycleSlug(lc.service_slug, map);
    if (!dv) return null;

    let clientName = '';
    try {
      const ctx = await this.lifecycle.context(lc.id);
      clientName = String(ctx.lead?.full_name ?? ctx.contract?.title ?? `#${lc.id}`).trim();
    } catch {
      clientName = `#${lc.id}`;
    }

    let profile = null;
    try {
      profile = await this.profiles.getByDvCode(dv.code);
    } catch {
      profile = null;
    }

    const isoWeek = currentIsoWeek();
    const summary = await this.weekly.countChecklistSummary(lc.id, isoWeek);
    const total = summary.pending + summary.done;
    const tasksDonePct = total > 0 ? Math.round((summary.done / total) * 100) : 0;

    const kpiRecord = await this.kpi.getRecord(lc.id, 'month', currentMonthKey());
    const kpiLabel = kpiRecord
      ? this.worstKpiLabel(
          computeMetricLabels(
            kpiRecord.metrics_json as Record<string, { actual?: number | null; target?: number | null }>,
            this.parseKpiDefinitions(profile?.kpi_definitions),
            'standard',
          ),
        )
      : null;

    const alertsOpen = await this.alerts.countOpen(lc.id);

    return {
      lifecycle_id: lc.id,
      client_name: clientName,
      dv_code: dv.code,
      dv_name: dv.name_vi,
      package_tier: 'standard',
      stage: lc.stage,
      kpi_label: kpiLabel,
      tasks_done_pct: tasksDonePct,
      alerts_open: alertsOpen,
      department: dv.department,
    };
  }

  async getAmDashboard(amId?: number): Promise<OpsDashboardAmPayload> {
    this.assertEnabled();
    const { lifecycles } = await this.lifecycle.list(undefined, amId ? String(amId) : undefined, '0');
    const instances: OpsDashboardInstance[] = [];
    for (const lc of lifecycles) {
      const row = await this.buildInstanceRow(lc);
      if (row) instances.push(row);
    }
    const datCount = instances.filter((i) => i.kpi_label === 'Dat').length;
    const withKpi = instances.filter((i) => i.kpi_label != null).length;
    return {
      role: 'am',
      instances,
      summary: {
        total: instances.length,
        alerts_open: instances.reduce((s, i) => s + i.alerts_open, 0),
        kpi_dat_pct: withKpi > 0 ? Math.round((datCount / withKpi) * 100) : 0,
      },
    };
  }

  async getTeamLeadDashboard(department?: string): Promise<OpsDashboardTeamLeadPayload> {
    this.assertEnabled();
    const amPayload = await this.getAmDashboard();
    const byDept = new Map<string, OpsDashboardInstance[]>();
    for (const inst of amPayload.instances) {
      const dept = inst.department ?? 'Khác';
      if (department && dept !== department) continue;
      const list = byDept.get(dept) ?? [];
      list.push(inst);
      byDept.set(dept, list);
    }
    return {
      role: 'team_lead',
      departments: [...byDept.entries()].map(([dept, instances]) => ({
        department: dept,
        instances,
        alerts_open: instances.reduce((s, i) => s + i.alerts_open, 0),
      })),
    };
  }

  async getSpecialistDashboard(): Promise<OpsDashboardSpecialistPayload> {
    this.assertEnabled();
    const { lifecycles } = await this.lifecycle.list(undefined, undefined, '0');
    const isoWeek = currentIsoWeek();
    const map = this.routeMap.getMap();
    const tasks: OpsDashboardSpecialistPayload['tasks'] = [];
    let pending = 0;
    let done = 0;

    for (const lc of lifecycles) {
      if (lc.status !== 'active') continue;
      const dv = resolveDvByLifecycleSlug(lc.service_slug, map);
      if (!dv) continue;
      const items = await this.weekly.listChecklistItems(lc.id, isoWeek);
      for (const item of items) {
        if (item.status === 'done') done += 1;
        else pending += 1;
        if (item.status === 'pending') {
          tasks.push({
            checklist_item_id: item.id,
            lifecycle_id: lc.id,
            dv_code: dv.code,
            title: item.title,
            owner_role: item.owner_role,
            status: item.status,
            iso_week: isoWeek,
          });
        }
      }
    }

    return {
      role: 'specialist',
      tasks: tasks.slice(0, 200),
      summary: { pending, done },
    };
  }

  async getExecutiveDashboard(): Promise<OpsDashboardExecutivePayload> {
    this.assertEnabled();
    const am = await this.getAmDashboard();
    const map = this.routeMap.getMap();
    const byDv = new Map<string, { name: string; instances: number; alerts_open: number }>();
    for (const inst of am.instances) {
      const cur = byDv.get(inst.dv_code) ?? {
        name: inst.dv_name,
        instances: 0,
        alerts_open: 0,
      };
      cur.instances += 1;
      cur.alerts_open += inst.alerts_open;
      byDv.set(inst.dv_code, cur);
    }
    const pilotCount = map.services.filter((s) => this.config.opsHubPilotDv.has(s.code)).length;
    return {
      role: 'executive',
      summary: {
        active_instances: am.instances.length,
        kpi_dat_pct: am.summary.kpi_dat_pct,
        alerts_open: am.summary.alerts_open,
        pilot_dv_count: pilotCount,
      },
      by_dv: [...byDv.entries()].map(([dv_code, v]) => ({ dv_code, ...v })),
    };
  }
}
