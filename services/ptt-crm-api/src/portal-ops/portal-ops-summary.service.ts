import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { currentIsoWeek, currentMonthKey } from '../ops/ops-hub.builder';
import {
  computeMetricLabels,
  type OpsKpiDefinition,
} from '../ops/ops-kpi-label.util';
import { OpsKpiPgRepository } from '../ops/ops-kpi-pg.repository';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { resolveDvByLifecycleSlug } from '../ops/ops-slug-resolver.util';
import { OpsWeeklyPgRepository } from '../ops/ops-weekly-pg.repository';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import {
  buildPortalOpsSummary,
  metricProgressPct,
  worstPortalKpiLabel,
} from './portal-ops-summary.util';
import type { OpsPortalLinkedLifecycle, OpsPortalSummary } from './portal-ops.types';

@Injectable()
export class PortalOpsSummaryService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly weekly: OpsWeeklyPgRepository,
    private readonly kpi: OpsKpiPgRepository,
  ) {}

  private isEnabled(): boolean {
    return this.config.opsPortalSummaryEnabled && this.config.opsDvEnabled;
  }

  private assertClient(user: PortalJwtPayload): string {
    const clientId = String(user.client_id ?? '').trim();
    if (!clientId) throw new ForbiddenException({ error: 'missing_client_id' });
    return clientId;
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

  private resolveDvForSlug(serviceSlug: string) {
    const map = this.routeMap.getMap();
    return resolveDvByLifecycleSlug(serviceSlug, map);
  }

  private async assertPortalLifecycleAccess(
    user: PortalJwtPayload,
    lifecycleId: number,
  ): Promise<{ serviceSlug: string; stage: string; packageTier: string }> {
    const clientId = this.assertClient(user);
    let ctx;
    try {
      ctx = await this.lifecycle.context(lifecycleId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
      }
      throw err;
    }
    const agencyClientId = String(ctx.contract.agency_client_id ?? '').trim();
    if (!agencyClientId || agencyClientId !== clientId) {
      throw new ForbiddenException({ error: 'lifecycle_client_mismatch' });
    }
    const serviceSlug = String(ctx.service_slug ?? '').trim();
    const dv = this.resolveDvForSlug(serviceSlug);
    if (!dv) {
      throw new ForbiddenException({ error: 'service_slug_not_mapped_dv', service_slug: serviceSlug });
    }
    if (
      this.config.opsHubPilotDv.size > 0 &&
      !this.config.opsHubPilotDv.has(dv.code)
    ) {
      throw new ForbiddenException({ error: 'dv_not_in_portal_pilot', dv_code: dv.code });
    }
    return {
      serviceSlug,
      stage: String(ctx.stage ?? ''),
      packageTier: 'standard',
    };
  }

  async linkedLifecycle(user: PortalJwtPayload): Promise<OpsPortalLinkedLifecycle> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        enabled: false,
        lifecycle_id: null,
        service_slug: null,
        dv_code: null,
        stage: null,
      };
    }
    const clientId = this.assertClient(user);
    const row = await this.lifecycle.findPrimaryLifecycleByAgencyClientId(clientId);
    if (!row) {
      return {
        ok: true,
        enabled: true,
        lifecycle_id: null,
        service_slug: null,
        dv_code: null,
        stage: null,
      };
    }
    const dv = this.resolveDvForSlug(row.service_slug);
    if (!dv || (this.config.opsHubPilotDv.size > 0 && !this.config.opsHubPilotDv.has(dv.code))) {
      return {
        ok: true,
        enabled: true,
        lifecycle_id: null,
        service_slug: null,
        dv_code: null,
        stage: null,
      };
    }
    return {
      ok: true,
      enabled: true,
      lifecycle_id: row.lifecycle_id,
      service_slug: row.service_slug,
      dv_code: dv.code,
      stage: row.stage,
    };
  }

  async lifecycleSummary(
    user: PortalJwtPayload,
    lifecycleId: number,
  ): Promise<OpsPortalSummary> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        enabled: false,
        lifecycle_id: lifecycleId,
        service_slug: '',
        dv_code: '',
        dv_name: '',
        stage: '',
        package_tier: 'standard',
        iso_week: currentIsoWeek(),
        weekly: { spawned: false, tasks_done: 0, tasks_total: 0, progress_pct: 0 },
        kpi: {
          period_type: 'month',
          period_key: currentMonthKey(),
          overall_label: null,
          metrics: [],
        },
        status_message_vi: 'Tóm tắt vận hành chưa bật trên hệ thống.',
      };
    }

    const { serviceSlug, stage, packageTier } = await this.assertPortalLifecycleAccess(
      user,
      lifecycleId,
    );
    const dv = this.resolveDvForSlug(serviceSlug)!;
    let profile = null;
    try {
      profile = await this.profiles.getByDvCode(dv.code);
    } catch {
      profile = null;
    }
    const kpiDefs = this.parseKpiDefinitions(profile?.kpi_definitions);
    const isoWeek = currentIsoWeek();
    const periodKey = currentMonthKey();

    const weeklySummary = await this.weekly.countChecklistSummary(lifecycleId, isoWeek);
    let metrics = computeMetricLabels({}, kpiDefs, packageTier);
    try {
      const record = await this.kpi.getRecord(lifecycleId, 'month', periodKey);
      if (record) {
        metrics = computeMetricLabels(
          record.metrics_json as Record<
            string,
            { actual?: number | null; target?: number | null }
          >,
          kpiDefs,
          packageTier,
        );
      }
    } catch {
      // PG optional
    }

    const portalMetrics = metrics
      .filter((m) => m.status_label != null)
      .map((m) => ({
        key: m.key,
        label: m.label,
        status_label: m.status_label!,
        progress_pct: metricProgressPct(m.actual ?? null, m.target ?? null),
      }));

    return buildPortalOpsSummary({
      lifecycleId,
      serviceSlug,
      dvCode: dv.code,
      dvName: dv.name_vi,
      stage,
      packageTier,
      isoWeek,
      weeklySpawned: weeklySummary.spawned,
      tasksDone: weeklySummary.done,
      tasksPending: weeklySummary.pending,
      periodKey,
      overallLabel: worstPortalKpiLabel(metrics),
      metrics: portalMetrics,
    });
  }
}
