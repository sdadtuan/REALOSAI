import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { SpcService } from '../spc/spc.service';
import { tierFromSkuCode } from '../spc/spc-sku.util';
import { OPS_PACKAGE_TIERS } from './ops.constants';
import { currentIsoWeek, currentMonthKey, buildOpsHubPayload } from './ops-hub.builder';
import {
  computeMetricLabels,
  type OpsKpiDefinition,
  type OpsKpiMetricInput,
} from './ops-kpi-label.util';
import { OpsKpiPgRepository } from './ops-kpi-pg.repository';
import { OpsAlertPgRepository } from './ops-alert-pg.repository';
import { OpsProfilePgRepository } from './ops-profile-pg.repository';
import { OpsRouteMapLoader } from './ops-route-map.loader';
import { resolveDvByLifecycleSlug } from './ops-slug-resolver.util';
import { OpsWeeklyPgRepository } from './ops-weekly-pg.repository';
import {
  canSpawnWeeklyTasks,
  flattenWeeklyTemplate,
} from './ops-weekly-template.util';
import type {
  OpsCatalogItem,
  OpsCatalogResponse,
  OpsHubPayload,
  OpsKpiMetricPayload,
  OpsKpiUpsertBody,
  OpsRouteMapService,
  OpsServiceProfileRow,
  OpsSpawnWeekResult,
  OpsWeeklyChecklistPayload,
} from './ops.types';

type ResolvedLifecycleDv = {
  lifecycleId: number;
  serviceSlug: string;
  status: string;
  stage: string;
  packageTier: string;
  skuCode: string | null;
  clientName: string;
  agencyClientId?: string;
  dv: OpsRouteMapService;
  profile: OpsServiceProfileRow | null;
  kpiDefinitions: OpsKpiDefinition[];
};

@Injectable()
export class OpsService implements OnModuleInit {
  constructor(
    private readonly config: AppConfigService,
    private readonly routeMapLoader: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly weekly: OpsWeeklyPgRepository,
    private readonly kpi: OpsKpiPgRepository,
    private readonly alerts: OpsAlertPgRepository,
    private readonly spc: SpcService,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.opsDvEnabled) return;
    try {
      const count = await this.profiles.countProfiles();
      if (count === 0) {
        await this.profiles.syncFromRouteMap(this.routeMapLoader.getMap().services);
      }
    } catch {
      // PG optional — route map still serves catalog/hub
    }
  }

  private assertEnabled(): void {
    if (!this.config.opsDvEnabled) {
      throw new ServiceUnavailableException({ error: 'ops_dv_disabled' });
    }
  }

  private hubFlags() {
    return {
      opsDvEnabled: this.config.opsDvEnabled,
      opsWeeklySpawnEnabled: this.config.opsWeeklySpawnEnabled,
      opsHubPilotDv: this.config.opsHubPilotDv,
      opsAgentEnabled: this.config.opsAgentEnabled,
    };
  }

  private parseKpiDefinitions(profile: OpsServiceProfileRow | null): OpsKpiDefinition[] {
    const raw = profile?.kpi_definitions ?? [];
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

  private mapChecklistItem(item: {
    id: number;
    template_task_id: string;
    title: string;
    owner_role: string;
    day_of_week: number | null;
    status: 'pending' | 'done' | 'skipped';
    kpi_key: string | null;
    completed_at: string | null;
  }): OpsWeeklyChecklistPayload {
    return {
      id: item.id,
      template_task_id: item.template_task_id,
      title: item.title,
      owner_role: item.owner_role,
      day_of_week: item.day_of_week,
      status: item.status,
      kpi_key: item.kpi_key,
      completed_at: item.completed_at,
    };
  }

  private mapKpiMetrics(metrics: OpsKpiMetricInput[]): OpsKpiMetricPayload[] {
    return metrics.map((m) => ({
      key: m.key,
      label: m.label,
      unit: m.unit,
      actual: m.actual ?? null,
      target: m.target ?? null,
      status_label: m.status_label,
    }));
  }

  private async resolveLifecycleDv(lifecycleId: number): Promise<ResolvedLifecycleDv> {
    const detail = await this.lifecycle.detail(lifecycleId);
    const serviceSlug = String(detail.service_slug ?? '').trim();
    const map = this.routeMapLoader.getMap();
    const dv = resolveDvByLifecycleSlug(serviceSlug, map);
    if (!dv) {
      throw new UnprocessableEntityException({
        error: 'unknown_service_slug',
        slug: serviceSlug,
      });
    }

    let profile: OpsServiceProfileRow | null = null;
    try {
      profile = await this.profiles.getByDvCode(dv.code);
    } catch {
      profile = null;
    }

    let clientName = '';
    let agencyClientId = '';
    try {
      const ctx = await this.lifecycle.context(lifecycleId);
      clientName = String(ctx.lead?.full_name ?? ctx.contract?.title ?? '').trim();
      agencyClientId = String(ctx.contract?.agency_client_id ?? '').trim();
    } catch {
      clientName = '';
    }

    const skuCodeRaw = String(detail.sku_code ?? '').trim();
    const skuCode = skuCodeRaw ? skuCodeRaw.toUpperCase() : null;
    const packageTier = skuCode
      ? tierFromSkuCode(skuCode) ?? 'standard'
      : 'standard';

    return {
      lifecycleId,
      serviceSlug,
      status: String(detail.status ?? ''),
      stage: String(detail.stage ?? ''),
      packageTier,
      skuCode,
      clientName,
      agencyClientId: agencyClientId || undefined,
      dv,
      profile,
      kpiDefinitions: this.parseKpiDefinitions(profile),
    };
  }

  health() {
    return {
      ok: true,
      ops_dv_enabled: this.config.opsDvEnabled,
      ops_weekly_spawn_enabled: this.config.opsWeeklySpawnEnabled,
      ops_spawn_on_deliver_enabled: this.config.opsSpawnOnDeliverEnabled,
      ops_agent_enabled: this.config.opsAgentEnabled,
      route_map: this.routeMapLoader.isLoaded()
        ? this.routeMapLoader.getLoadedPath()
        : null,
    };
  }

  private routeEntryToCatalogItem(entry: OpsRouteMapService): OpsCatalogItem {
    return {
      dv_code: entry.code,
      name: entry.name_vi,
      service_slug: entry.service_slugs.primary,
      readiness: entry.readiness,
      package_tiers: [...OPS_PACKAGE_TIERS],
      depends_on_dv: entry.depends_on_dv ?? [],
      tier_pricing: {},
      ops_web: (entry.ops_web ?? {}) as Record<string, unknown>,
    };
  }

  private profileToCatalogItem(row: OpsServiceProfileRow, entry?: OpsRouteMapService | null): OpsCatalogItem {
    return {
      dv_code: row.dv_code,
      name: row.name,
      service_slug: row.service_slug,
      readiness: row.readiness,
      package_tiers: [...OPS_PACKAGE_TIERS],
      depends_on_dv: entry?.depends_on_dv ?? [],
      tier_pricing: (row.tier_pricing ?? {}) as Record<string, unknown>,
      ops_web: row.ops_web_json,
    };
  }

  async getCatalog(): Promise<OpsCatalogResponse> {
    this.assertEnabled();
    const map = this.routeMapLoader.getMap();
    let rows: OpsServiceProfileRow[] = [];
    try {
      rows = await this.profiles.listProfiles();
    } catch {
      rows = [];
    }
    let skuByDv = new Map<string, OpsCatalogItem['skus']>();
    try {
      const offers = await this.spc.listPublishedOffersForOpsCatalog();
      skuByDv = offers.reduce((acc, offer) => {
        const list = acc.get(offer.dv_code) ?? [];
        list.push({
          sku_code: offer.sku_code,
          tier: offer.tier,
          label_vi: offer.label_vi,
          pricing_model: offer.pricing_model as Record<string, unknown>,
          status: offer.status,
        });
        acc.set(offer.dv_code, list);
        return acc;
      }, new Map<string, NonNullable<OpsCatalogItem['skus']>>());
    } catch {
      skuByDv = new Map();
    }
    const services =
      rows.length > 0
        ? rows.map((row) => {
            const entry = map.services.find((s) => s.code === row.dv_code) ?? null;
            const item = this.profileToCatalogItem(row, entry);
            item.skus = skuByDv.get(row.dv_code) ?? [];
            return item;
          })
        : map.services.map((entry) => {
            const item = this.routeEntryToCatalogItem(entry);
            item.skus = skuByDv.get(entry.code) ?? [];
            return item;
          });
    return {
      schema_version: map.schema_version ?? '1.0.0',
      services,
      spc_enabled: skuByDv.size > 0,
    };
  }

  async getCatalogByCode(dvCode: string) {
    this.assertEnabled();
    const code = String(dvCode ?? '').trim().toUpperCase();
    const map = this.routeMapLoader.getMap();
    let profile: OpsServiceProfileRow | null = null;
    try {
      profile = await this.profiles.getByDvCode(code);
    } catch {
      profile = null;
    }
    const entry = map.services.find((s) => s.code === code);
    if (!profile && !entry) {
      throw new NotFoundException({ error: 'dv_not_found' });
    }
    return {
      profile: profile
        ? {
            ...profile,
            package_tiers: [...OPS_PACKAGE_TIERS],
            route_entry: entry ?? null,
          }
        : {
            dv_code: entry!.code,
            name: entry!.name_vi,
            service_slug: entry!.service_slugs.primary,
            readiness: entry!.readiness,
            service_slugs_json: entry!.service_slugs,
            ops_web_json: entry!.ops_web ?? {},
            nest_api_json: entry!.nest_api ?? {},
            weekly_process_template: [],
            kpi_definitions: [],
            tier_pricing: {},
            package_tiers: [...OPS_PACKAGE_TIERS],
          },
    };
  }

  private async loadWeeklySnapshot(lifecycleId: number, isoWeek: string) {
    try {
      const summary = await this.weekly.countChecklistSummary(lifecycleId, isoWeek);
      const items = summary.spawned
        ? (await this.weekly.listChecklistItems(lifecycleId, isoWeek)).map((item) =>
            this.mapChecklistItem(item),
          )
        : [];
      return { ...summary, items };
    } catch {
      return { pending: 0, done: 0, spawned: false, items: [] as OpsWeeklyChecklistPayload[] };
    }
  }

  private async loadKpiSnapshot(
    resolved: ResolvedLifecycleDv,
    periodType: 'week' | 'month',
    periodKey: string,
  ) {
    try {
      const record = await this.kpi.getRecord(resolved.lifecycleId, periodType, periodKey);
      if (record) {
        const raw = record.metrics_json as Record<
          string,
          { actual?: number | null; target?: number | null; label?: string; unit?: string; status_label?: string }
        >;
        const metrics = computeMetricLabels(raw, resolved.kpiDefinitions, resolved.packageTier);
        return this.mapKpiMetrics(metrics);
      }
    } catch {
      // fall through
    }
    return this.mapKpiMetrics(
      computeMetricLabels({}, resolved.kpiDefinitions, resolved.packageTier),
    );
  }

  private async loadAlertsSnapshot(lifecycleId: number) {
    try {
      const [openCount, rows] = await Promise.all([
        this.alerts.countOpen(lifecycleId),
        this.alerts.listAlerts({ lifecycleId, status: 'open', limit: 20 }),
      ]);
      return {
        open_count: openCount,
        items: rows.map((row) => this.alerts.mapToPayload(row)),
      };
    } catch {
      return { open_count: 0, items: [] };
    }
  }

  async getHub(lifecycleId: number): Promise<OpsHubPayload> {
    this.assertEnabled();
    const resolved = await this.resolveLifecycleDv(lifecycleId);
    const isoWeek = currentIsoWeek();
    const [weeklySnapshot, kpiMetrics, alertsSnapshot] = await Promise.all([
      this.loadWeeklySnapshot(lifecycleId, isoWeek),
      this.loadKpiSnapshot(resolved, 'month', currentMonthKey()),
      this.loadAlertsSnapshot(lifecycleId),
    ]);

    return buildOpsHubPayload({
      ctx: {
        lifecycleId: resolved.lifecycleId,
        serviceSlug: resolved.serviceSlug,
        status: resolved.status,
        stage: resolved.stage,
        clientName: resolved.clientName,
        packageTier: resolved.packageTier,
        agencyClientId: resolved.agencyClientId,
      },
      dv: resolved.dv,
      profile: resolved.profile,
      flags: this.hubFlags(),
      weeklySnapshot: {
        spawned: weeklySnapshot.spawned,
        tasks_pending: weeklySnapshot.pending,
        tasks_done: weeklySnapshot.done,
        items: weeklySnapshot.items,
      },
      kpiSnapshot: {
        period_type: 'month',
        period_key: currentMonthKey(),
        metrics: kpiMetrics,
      },
      alertsSnapshot,
    });
  }

  async spawnWeek(lifecycleId: number, spawnedBy = 'staff'): Promise<OpsSpawnWeekResult> {
    this.assertEnabled();
    const resolved = await this.resolveLifecycleDv(lifecycleId);
    const gate = canSpawnWeeklyTasks({
      status: resolved.status,
      stage: resolved.stage,
      spawnEnabled: this.config.opsWeeklySpawnEnabled,
    });
    if (!gate.ok) {
      throw new BadRequestException({ error: gate.error });
    }

    const skuCode = this.spc.inferSkuForLifecycle(
      resolved.dv.code,
      resolved.skuCode,
      resolved.packageTier,
    );
    let templateTasks = flattenWeeklyTemplate(resolved.profile?.weekly_process_template);
    let phaseCode: string | undefined;
    let taskSource: 'spc' | 'legacy' = 'legacy';

    try {
      const phases = await this.spc.resolveProcessPhases(resolved.dv.code, skuCode);
      if (phases.length > 0) {
        const spawnCount = await this.weekly.countDistinctSpawnWeeks(lifecycleId);
        const spawnPhase = this.spc.resolveSpawnPhaseTasks(phases, spawnCount);
        templateTasks = spawnPhase.tasks;
        phaseCode = spawnPhase.phase_code;
        taskSource = 'spc';
      }
    } catch {
      // fallback legacy weekly_process_template
    }

    if (templateTasks.length === 0) {
      throw new UnprocessableEntityException({ error: 'empty_weekly_template', dv_code: resolved.dv.code });
    }

    const isoWeek = currentIsoWeek();
    const result = await this.weekly.spawnWeek({
      lifecycleId,
      isoWeek,
      dvCode: resolved.dv.code,
      tasks: templateTasks,
      spawnedBy,
      phaseCode,
      skuCode,
    });

    return {
      iso_week: isoWeek,
      dv_code: resolved.dv.code,
      sku_code: skuCode,
      phase_code: phaseCode,
      task_source: taskSource,
      created: result.created,
      already_spawned: result.already_spawned,
      items: result.items.map((item) => this.mapChecklistItem(item)),
    };
  }

  async getWeeklyChecklist(lifecycleId: number, isoWeek?: string) {
    this.assertEnabled();
    await this.resolveLifecycleDv(lifecycleId);
    const week = isoWeek?.trim() || currentIsoWeek();
    const items = await this.weekly.listChecklistItems(lifecycleId, week);
    const summary = await this.weekly.countChecklistSummary(lifecycleId, week);
    return {
      iso_week: week,
      spawned: summary.spawned,
      tasks_pending: summary.pending,
      tasks_done: summary.done,
      items: items.map((item) => this.mapChecklistItem(item)),
    };
  }

  async patchWeeklyItem(
    lifecycleId: number,
    itemId: number,
    status: 'pending' | 'done' | 'skipped',
  ) {
    this.assertEnabled();
    await this.resolveLifecycleDv(lifecycleId);
    const updated = await this.weekly.updateChecklistItemStatus(lifecycleId, itemId, status);
    if (!updated) {
      throw new NotFoundException({ error: 'checklist_item_not_found' });
    }
    return this.mapChecklistItem(updated);
  }

  async getKpiRecords(
    lifecycleId: number,
    periodType?: 'week' | 'month',
    periodKey?: string,
  ) {
    this.assertEnabled();
    const resolved = await this.resolveLifecycleDv(lifecycleId);
    const type = periodType ?? 'month';
    const key = periodKey?.trim() || (type === 'month' ? currentMonthKey() : currentIsoWeek());
    const metrics = await this.loadKpiSnapshot(resolved, type, key);
    return {
      lifecycle_id: lifecycleId,
      dv_code: resolved.dv.code,
      period_type: type,
      period_key: key,
      metrics,
    };
  }

  async upsertKpi(lifecycleId: number, body: OpsKpiUpsertBody) {
    this.assertEnabled();
    const resolved = await this.resolveLifecycleDv(lifecycleId);
    const periodType = body.period_type ?? 'month';
    const periodKey =
      body.period_key?.trim() || (periodType === 'month' ? currentMonthKey() : currentIsoWeek());
    if (!body.metrics || typeof body.metrics !== 'object') {
      throw new BadRequestException({ error: 'metrics_required' });
    }

    const result = await this.kpi.upsertMetrics({
      lifecycleId,
      dvCode: resolved.dv.code,
      periodType,
      periodKey,
      metrics: body.metrics,
      definitions: resolved.kpiDefinitions,
      packageTier: resolved.packageTier,
      source: 'manual',
    });

    return {
      lifecycle_id: lifecycleId,
      dv_code: resolved.dv.code,
      period_type: periodType,
      period_key: periodKey,
      metrics: this.mapKpiMetrics(result.metrics),
    };
  }

  async computeKpiLabels(
    lifecycleId: number,
    periodType: 'week' | 'month' = 'month',
    periodKey?: string,
  ) {
    this.assertEnabled();
    const resolved = await this.resolveLifecycleDv(lifecycleId);
    const key =
      periodKey?.trim() || (periodType === 'month' ? currentMonthKey() : currentIsoWeek());
    const result = await this.kpi.recomputeLabels(
      lifecycleId,
      periodType,
      key,
      resolved.kpiDefinitions,
      resolved.packageTier,
    );
    return {
      lifecycle_id: lifecycleId,
      dv_code: resolved.dv.code,
      period_type: periodType,
      period_key: key,
      metrics: this.mapKpiMetrics(result.metrics),
    };
  }

  async listAlerts(input: { lifecycleId?: number; status?: 'open' | 'acknowledged'; limit?: number }) {
    this.assertEnabled();
    const rows = await this.alerts.listAlerts(input);
    return {
      items: rows.map((row) => this.alerts.mapToPayload(row)),
      total: rows.length,
    };
  }

  async acknowledgeAlert(alertId: number, actor: string) {
    this.assertEnabled();
    const row = await this.alerts.acknowledgeAlert(alertId, actor);
    if (!row) {
      throw new NotFoundException({ error: 'alert_not_found' });
    }
    return this.alerts.mapToPayload(row);
  }
}
