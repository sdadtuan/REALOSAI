import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { currentIsoWeek, currentMonthKey } from './ops-hub.builder';
import { computeMetricLabels, type OpsKpiDefinition } from './ops-kpi-label.util';
import { OpsAlertPgRepository } from './ops-alert-pg.repository';
import type { OpsAlertSeverity, OpsAlertType } from './ops-alert.types';
import { OpsKpiPgRepository } from './ops-kpi-pg.repository';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { resolveDvByLifecycleSlug } from './ops-slug-resolver.util';
import { OpsWeeklyPgRepository } from './ops-weekly-pg.repository';

const DELIVER_STAGES = new Set(['onboard', 'deliver', 'handover', 'retain']);

@Injectable()
export class OpsAgentScanService {
  constructor(
    private readonly config: AppConfigService,
    private readonly alerts: OpsAlertPgRepository,
    private readonly weekly: OpsWeeklyPgRepository,
    private readonly kpi: OpsKpiPgRepository,
    private readonly profiles: OpsProfilePgRepository,
    private readonly routeMap: OpsRouteMapLoader,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  async runScan(opts: { dryRun?: boolean } = {}) {
    if (!this.config.opsDvEnabled || !this.config.opsAgentEnabled) {
      return { ok: false, error: 'ops_agent_disabled', created: 0, scanned: 0 };
    }
    if (!this.alerts.canUsePg()) {
      return { ok: false, error: 'ops_alert_pg_unavailable', created: 0, scanned: 0 };
    }

    const { lifecycles } = await this.lifecycle.list(undefined, undefined, '0');
    const map = this.routeMap.getMap();
    const isoWeek = currentIsoWeek();
    const monthKey = currentMonthKey();
    const todayDow = new Date().getDay() || 7;
    let created = 0;
    let scanned = 0;

    for (const lc of lifecycles) {
      if (lc.status !== 'active') continue;
      if (!DELIVER_STAGES.has(String(lc.stage ?? '').toLowerCase())) continue;
      const dv = resolveDvByLifecycleSlug(lc.service_slug, map);
      if (!dv) continue;
      scanned += 1;

      let profile = null;
      try {
        profile = await this.profiles.getByDvCode(dv.code);
      } catch {
        profile = null;
      }
      const kpiDefs = this.parseKpiDefinitions(profile?.kpi_definitions);

      const kpiRecord = await this.kpi.getRecord(lc.id, 'month', monthKey);
      if (kpiRecord) {
        const metrics = computeMetricLabels(
          kpiRecord.metrics_json as Record<string, { actual?: number | null; target?: number | null }>,
          kpiDefs,
          'standard',
        );
        for (const m of metrics) {
          if (m.status_label === 'CanChuY') {
            created += await this.emitAlert(
              {
                lifecycleId: lc.id,
                dvCode: dv.code,
                alertType: 'kpi_warning',
                severity: 'warning',
                title: `KPI cần chú ý: ${m.label}`,
                message: `${m.label}: ${m.actual ?? '—'}/${m.target ?? '—'}`,
                sourceKey: `kpi:${lc.id}:${monthKey}:${m.key}:CanChuY`,
              },
              opts.dryRun,
            );
          } else if (m.status_label === 'KhongDat') {
            created += await this.emitAlert(
              {
                lifecycleId: lc.id,
                dvCode: dv.code,
                alertType: 'kpi_critical',
                severity: 'critical',
                title: `KPI không đạt: ${m.label}`,
                message: `${m.label}: ${m.actual ?? '—'}/${m.target ?? '—'}`,
                sourceKey: `kpi:${lc.id}:${monthKey}:${m.key}:KhongDat`,
              },
              opts.dryRun,
            );
          }
        }
      }

      const items = await this.weekly.listChecklistItems(lc.id, isoWeek);
      for (const item of items) {
        if (item.status === 'done' || item.status === 'skipped') continue;
        const dow = item.day_of_week;
        if (dow == null) continue;
        if (dow < todayDow) {
          created += await this.emitAlert(
            {
              lifecycleId: lc.id,
              dvCode: dv.code,
              alertType: 'task_overdue',
              severity: 'critical',
              title: `Task quá hạn: ${item.title}`,
              message: item.title,
              sourceKey: `task:${lc.id}:${isoWeek}:${item.template_task_id}:overdue`,
            },
            opts.dryRun,
          );
        } else if (dow <= todayDow + 2) {
          created += await this.emitAlert(
            {
              lifecycleId: lc.id,
              dvCode: dv.code,
              alertType: 'task_due_soon',
              severity: 'warning',
              title: `Task sắp đến hạn: ${item.title}`,
              message: item.title,
              sourceKey: `task:${lc.id}:${isoWeek}:${item.template_task_id}:due_soon`,
            },
            opts.dryRun,
          );
        }
      }
    }

    return { ok: true, scanned, created, iso_week: isoWeek, period_key: monthKey };
  }

  private async emitAlert(
    input: {
      lifecycleId: number;
      dvCode: string;
      alertType: OpsAlertType;
      severity: OpsAlertSeverity;
      title: string;
      message: string;
      sourceKey: string;
    },
    dryRun?: boolean,
  ): Promise<number> {
    if (dryRun) return 0;
    const result = await this.alerts.upsertAlert({
      lifecycleId: input.lifecycleId,
      dvCode: input.dvCode,
      alertType: input.alertType,
      severity: input.severity,
      title: input.title,
      message: input.message,
      sourceKey: input.sourceKey,
    });
    return result === 'created' ? 1 : 0;
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
}
