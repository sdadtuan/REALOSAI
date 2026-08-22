import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsAlertPgRepository } from '../ops/ops-alert-pg.repository';
import { OpsService } from '../ops/ops.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { buildKpiClosedLoopPayload } from './marketing-ai-kpi-closed-loop.util';
import type { MktAiKpiClosedLoopPayload } from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiKpiClosedLoopService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly dashboard: MarketingAiDashboardService,
    private readonly repo: MarketingAiPlannerRepository,
    @Inject(forwardRef(() => OpsService)) private readonly ops: OpsService,
    private readonly opsAlerts: OpsAlertPgRepository,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiKpiClosedLoopEnabled;
  }

  status() {
    return {
      ok: true,
      enabled: this.isEnabled(),
      planner_enabled: this.config.mktAiPlannerEnabled,
      closed_loop_enabled: this.config.mktAiKpiClosedLoopEnabled,
      ops_dv_enabled: this.config.opsDvEnabled,
      alert_threshold_pct: this.config.mktAiKpiAlertCplPct,
      weekly_memo_cron: this.config.mktAiWeeklyMemoCron,
    };
  }

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new NotFoundException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
    if (!this.isEnabled()) {
      throw new NotFoundException({ error: 'mkt_ai_kpi_closed_loop_disabled' });
    }
  }

  private async loadOpsMetrics(
    lifecycleId: number,
  ): Promise<Record<string, { actual?: number | null }> | undefined> {
    if (!this.config.opsDvEnabled) return undefined;
    try {
      const kpi = await this.ops.getKpiRecords(lifecycleId, 'month');
      const out: Record<string, { actual?: number | null }> = {};
      for (const metric of kpi.metrics ?? []) {
        out[metric.key] = { actual: metric.actual ?? null };
      }
      return Object.keys(out).length ? out : undefined;
    } catch {
      return undefined;
    }
  }

  private async emitPlanOpsDriftAlerts(
    lifecycleId: number,
    payload: MktAiKpiClosedLoopPayload,
  ): Promise<void> {
    if (!payload.alerts.length || !this.config.opsDvEnabled || !this.opsAlerts.canUsePg()) {
      return;
    }
    let dvCode = 'DV00';
    try {
      const kpi = await this.ops.getKpiRecords(lifecycleId, 'month');
      dvCode = String(kpi.dv_code ?? 'DV00');
    } catch {
      return;
    }

    for (const row of payload.alerts) {
      await this.opsAlerts.upsertAlert({
        lifecycleId,
        dvCode,
        alertType: 'plan_ops_drift',
        severity: 'warning',
        title: `Plan vs Ops lệch: ${row.label}`,
        message: `${row.label}: Plan ${row.target_display} · Actual ${row.actual_display} (${fmtPct(row.delta_pct)})`,
        sourceKey: `plan_ops_drift:${lifecycleId}:${row.id}:${payload.period.month_start}`,
      });
    }
  }

  async getClosedLoop(
    lifecycleId: number,
    opts: { weeks?: number; channel?: string; emitAlerts?: boolean } = {},
  ): Promise<MktAiKpiClosedLoopPayload> {
    const lc = await this.lifecycle.detail(lifecycleId);
    const serviceSlug = String((lc as Record<string, unknown>).service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const draft = await this.repo.ensureDraft(lifecycleId, 'kpi-closed-loop');
    const dashboard = await this.dashboard.getDashboard(lifecycleId, {
      weeks: opts.weeks ?? 6,
      channel: opts.channel ?? 'meta',
    });
    const opsMetrics = await this.loadOpsMetrics(lifecycleId);

    const payload = buildKpiClosedLoopPayload({
      enabled: true,
      lifecycleId,
      appliedTree: draft.kpi_tree_applied_json,
      dashboard,
      thresholdPct: this.config.mktAiKpiAlertCplPct,
      opsMetrics,
    });

    if (opts.emitAlerts !== false) {
      await this.emitPlanOpsDriftAlerts(lifecycleId, payload);
    }

    return payload;
  }
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}
