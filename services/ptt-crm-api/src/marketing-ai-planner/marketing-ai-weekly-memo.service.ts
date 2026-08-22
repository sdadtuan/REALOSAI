import { Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiKpiClosedLoopService } from './marketing-ai-kpi-closed-loop.service';
import { MarketingAiOptimizeService } from './marketing-ai-optimize.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import {
  buildKpiClosedLoopDashboardLink,
  buildWeeklyMemoAlertKey,
} from './marketing-ai-kpi-closed-loop.util';
import { buildWeeklyOptimizationMemo } from './marketing-ai-weekly-memo.util';
import type {
  MktAiWeeklyMemoCronRunResult,
  MktAiWeeklyMemoPayload,
  MktAiWeeklyMemoResult,
} from './marketing-ai-planner.types';
import type { ServiceLifecycleRow } from '../service-lifecycle/service-lifecycle.types';

@Injectable()
export class MarketingAiWeeklyMemoService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketingAiWeeklyMemoService.name);
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly dashboard: MarketingAiDashboardService,
    private readonly closedLoop: MarketingAiKpiClosedLoopService,
    private readonly optimize: MarketingAiOptimizeService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly notifications: StaffNotificationsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  isEnabled(): boolean {
    return this.closedLoop.isEnabled();
  }

  status() {
    return {
      ok: true,
      enabled: this.isEnabled(),
      cron_expression: this.config.mktAiWeeklyMemoCron,
      closed_loop: this.closedLoop.status(),
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

  async buildMemoForLifecycle(lifecycleId: number): Promise<MktAiWeeklyMemoPayload> {
    const lc = await this.lifecycle.detail(lifecycleId);
    const serviceSlug = String((lc as Record<string, unknown>).service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const closedLoop = await this.closedLoop.getClosedLoop(lifecycleId, { weeks: 6, channel: 'meta' });
    const optimizeOut = await this.optimize.execute(lifecycleId, { channel: 'meta' });
    const brandLabel = await this.resolveBrandLabel({ id: lifecycleId } as ServiceLifecycleRow);

    const weekLabel =
      closedLoop.period.to && closedLoop.rows.length
        ? `Tuần kết thúc ${closedLoop.period.to}`
        : new Date().toISOString().slice(0, 10);

    return buildWeeklyOptimizationMemo({
      brandLabel,
      weekLabel,
      closedLoop,
      recommendations: optimizeOut.recommendations,
    });
  }

  async runWeeklyCron(opts: { dryRun?: boolean } = {}): Promise<MktAiWeeklyMemoCronRunResult> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        skipped: true,
        reason: 'mkt_ai_kpi_closed_loop_disabled',
        scanned: 0,
        memos_generated: 0,
        notifications_sent: 0,
        skipped_dedupe: 0,
        errors: [],
      };
    }

    const candidates = await this.listCandidates();
    let memosGenerated = 0;
    let notificationsSent = 0;
    let skippedDedupe = 0;
    const errors: string[] = [];

    for (const lc of candidates) {
      try {
        const dash = await this.dashboard.getDashboard(lc.id, { weeks: 6, channel: 'meta' });
        if (!dash.linked) continue;

        const memo = await this.buildMemoForLifecycle(lc.id);
        memosGenerated += 1;

        const weekStart = dash.trend.length
          ? dash.trend[dash.trend.length - 1].week_start
          : dash.period.to;
        const alertKey = buildWeeklyMemoAlertKey(lc.id, weekStart);

        if (
          await this.notifications.hasRecentAlertKey(
            alertKey,
            this.config.mktAiKpiAlertCooldownDays,
          )
        ) {
          skippedDedupe += 1;
          continue;
        }

        const sent = await this.notifyMemo(lc, memo, alertKey, opts.dryRun === true);
        if (sent) notificationsSent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`lifecycle ${lc.id}: ${message}`);
        this.logger.warn(`Weekly memo failed for lifecycle ${lc.id}: ${message}`);
      }
    }

    return {
      ok: errors.length === 0,
      scanned: candidates.length,
      memos_generated: memosGenerated,
      notifications_sent: notificationsSent,
      skipped_dedupe: skippedDedupe,
      errors: errors.slice(0, 20),
    };
  }

  wrapJobResult(memo: MktAiWeeklyMemoPayload, notificationSent?: boolean): Omit<MktAiWeeklyMemoResult, 'job_id' | 'status'> {
    return {
      ok: true,
      memo,
      notification_sent: notificationSent,
    };
  }

  async maybeNotifyMemo(
    lifecycleId: number,
    memo: MktAiWeeklyMemoPayload,
    opts: { dryRun?: boolean } = {},
  ): Promise<boolean> {
    const lcRow = await this.lifecycle.detail(lifecycleId);
    const lc = lcRow as unknown as ServiceLifecycleRow;
    const dash = await this.dashboard.getDashboard(lifecycleId, { weeks: 6, channel: 'meta' });
    const weekStart = dash.trend.length ? dash.trend[dash.trend.length - 1].week_start : dash.period.to;
    const alertKey = buildWeeklyMemoAlertKey(lifecycleId, weekStart);
    if (
      await this.notifications.hasRecentAlertKey(alertKey, this.config.mktAiKpiAlertCooldownDays)
    ) {
      return false;
    }
    return this.notifyMemo(lc, memo, alertKey, opts.dryRun === true);
  }

  private async listCandidates(): Promise<ServiceLifecycleRow[]> {
    const { lifecycles } = await this.lifecycle.list(undefined, undefined, undefined);
    const slugs = this.config.mktAiPlannerSlugs;
    return lifecycles.filter((lc) => {
      if (lc.stage !== 'deliver' && lc.stage !== 'retain') return false;
      if (slugs.length && !slugs.includes(lc.service_slug)) return false;
      return true;
    });
  }

  private async resolveBrandLabel(lc: ServiceLifecycleRow): Promise<string> {
    try {
      const ctx = await this.lifecycle.context(lc.id);
      const leadName = String(ctx.lead?.full_name ?? '').trim();
      if (leadName) return leadName;
      const contractTitle = String(ctx.contract?.title ?? '').trim();
      if (contractTitle) return contractTitle;
    } catch {
      /* optional */
    }
    return `Lifecycle #${lc.id}`;
  }

  private async resolveRecipientUserIds(lc: ServiceLifecycleRow): Promise<string[]> {
    const ids = new Set<string>();

    for (const staffId of [lc.assigned_am, lc.assigned_sp]) {
      if (staffId != null && staffId > 0) {
        const uid = await this.resolveUserIdByCrmStaffId(staffId);
        if (uid) ids.add(uid);
      }
    }

    for (const uid of this.config.mktAiApproverNotifyUserIds) {
      if (uid.trim()) ids.add(uid.trim());
    }

    return [...ids];
  }

  private async resolveUserIdByCrmStaffId(staffId: number): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT u.id::text AS user_id
         FROM staff_users u
         JOIN crm_staff s ON lower(trim(s.email)) = lower(trim(u.email))
         WHERE s.id = $1 AND COALESCE(s.active, TRUE) IS TRUE AND u.active IS TRUE
         LIMIT 1`,
        [staffId],
      );
      const uid = result.rows[0]?.user_id;
      return uid ? String(uid) : null;
    } catch {
      return null;
    }
  }

  private async notifyMemo(
    lc: ServiceLifecycleRow,
    memo: MktAiWeeklyMemoPayload,
    alertKey: string,
    dryRun: boolean,
  ): Promise<boolean> {
    const recipientIds = await this.resolveRecipientUserIds(lc);
    if (!recipientIds.length) return false;
    if (dryRun) return true;

    const link = buildKpiClosedLoopDashboardLink(lc.id);
    await this.notifications.createMany(
      recipientIds.map((user_id) => ({
        user_id,
        kind: 'mkt_ai_weekly_memo',
        title: memo.title,
        body: memo.body_vi.slice(0, 500),
        link_href: link,
        meta_json: {
          alert_key: alertKey,
          lifecycle_id: lc.id,
          week_label: memo.week_label,
          auto_apply: false,
        },
      })),
    );
    return true;
  }
}
