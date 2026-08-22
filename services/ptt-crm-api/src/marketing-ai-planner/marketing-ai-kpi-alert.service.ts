import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import {
  buildKpiAlertDashboardLink,
  detectKpiDrifts,
  type MktAiKpiDriftFinding,
} from './marketing-ai-kpi-alert.util';
import type { ServiceLifecycleRow } from '../service-lifecycle/service-lifecycle.types';

export interface MktAiKpiAlertRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  scanned: number;
  drift_found: number;
  notifications_sent: number;
  skipped_dedupe: number;
  skipped_unlinked: number;
  errors: string[];
}

@Injectable()
export class MarketingAiKpiAlertService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketingAiKpiAlertService.name);
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly dashboard: MarketingAiDashboardService,
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
    return (
      this.config.mktAiPlannerEnabled &&
      this.config.mktAiKpiAlertEnabled
    );
  }

  status() {
    return {
      ok: true,
      enabled: this.isEnabled(),
      planner_enabled: this.config.mktAiPlannerEnabled,
      alert_enabled: this.config.mktAiKpiAlertEnabled,
      cpl_threshold_pct: this.config.mktAiKpiAlertCplPct,
      roas_threshold_pct: this.config.mktAiKpiAlertRoasPct,
      cooldown_days: this.config.mktAiKpiAlertCooldownDays,
    };
  }

  async runWeeklyScan(opts: { dryRun?: boolean } = {}): Promise<MktAiKpiAlertRunResult> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        skipped: true,
        reason: 'mkt_ai_kpi_alert_disabled',
        scanned: 0,
        drift_found: 0,
        notifications_sent: 0,
        skipped_dedupe: 0,
        skipped_unlinked: 0,
        errors: [],
      };
    }

    const candidates = await this.listCandidates();
    let driftFound = 0;
    let notificationsSent = 0;
    let skippedDedupe = 0;
    let skippedUnlinked = 0;
    const errors: string[] = [];

    for (const lc of candidates) {
      try {
        const dash = await this.dashboard.getDashboard(lc.id, { weeks: 6, channel: 'meta' });
        if (!dash.linked) {
          skippedUnlinked += 1;
          continue;
        }

        const brandLabel = await this.resolveBrandLabel(lc);
        const findings = detectKpiDrifts({
          lifecycleId: lc.id,
          brandLabel,
          dashboard: dash,
          cplThresholdPct: this.config.mktAiKpiAlertCplPct,
          roasThresholdPct: this.config.mktAiKpiAlertRoasPct,
        });

        driftFound += findings.length;

        for (const finding of findings) {
          const sent = await this.notifyFinding(lc, dash.agency_client_id, finding, opts.dryRun === true);
          if (sent === 'dedupe') skippedDedupe += 1;
          else if (sent === 'sent') notificationsSent += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`lifecycle ${lc.id}: ${message}`);
        this.logger.warn(`KPI alert scan failed for lifecycle ${lc.id}: ${message}`);
      }
    }

    return {
      ok: errors.length === 0,
      scanned: candidates.length,
      drift_found: driftFound,
      notifications_sent: notificationsSent,
      skipped_dedupe: skippedDedupe,
      skipped_unlinked: skippedUnlinked,
      errors: errors.slice(0, 20),
    };
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

  private async notifyFinding(
    lc: ServiceLifecycleRow,
    agencyClientId: string | null,
    finding: MktAiKpiDriftFinding,
    dryRun: boolean,
  ): Promise<'sent' | 'dedupe' | 'skipped'> {
    if (
      await this.notifications.hasRecentAlertKey(
        finding.alert_key,
        this.config.mktAiKpiAlertCooldownDays,
      )
    ) {
      return 'dedupe';
    }

    const recipientIds = await this.resolveRecipientUserIds(lc);
    if (!recipientIds.length) return 'skipped';

    if (dryRun) return 'sent';

    const link = buildKpiAlertDashboardLink(lc.id);
    const meta = {
      alert_key: finding.alert_key,
      lifecycle_id: lc.id,
      metric: finding.metric,
      delta_pct: finding.delta_pct,
      agency_client_id: agencyClientId,
    };

    await this.notifications.createMany(
      recipientIds.map((user_id) => ({
        user_id,
        kind: 'mkt_ai_kpi_drift',
        title: finding.title,
        body: finding.body,
        link_href: link,
        meta_json: meta,
      })),
    );

    return 'sent';
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
}
