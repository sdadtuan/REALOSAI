import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PerformanceService } from '../performance/performance.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import {
  buildDashboardDeltas,
  buildDashboardTargets,
  buildDashboardTiles,
  buildDashboardTrend,
  resolveDashboardDateWindow,
} from './marketing-ai-dashboard.util';
import type { MktAiDashboardPayload } from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiDashboardService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly performance: PerformanceService,
  ) {}

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new NotFoundException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
  }

  async getDashboard(
    lifecycleId: number,
    opts: { weeks?: number; channel?: string } = {},
  ): Promise<MktAiDashboardPayload> {
    const lc = await this.lifecycle.detail(lifecycleId);
    const stage = String((lc as Record<string, unknown>).stage ?? '');
    const serviceSlug = String((lc as Record<string, unknown>).service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const weeks = Math.min(12, Math.max(1, Number(opts.weeks ?? 6) || 6));
    const { dateFrom, dateTo, monthStart } = resolveDashboardDateWindow(weeks);

    let agencyClientId: string | null = null;
    const contextMessages: string[] = [];
    try {
      const ctx = await this.lifecycle.context(lifecycleId);
      agencyClientId = String(ctx.contract.agency_client_id ?? '').trim() || null;
    } catch {
      contextMessages.push(
        'Không tải lifecycle context — Actual KPI có thể thiếu (kiểm tra schema service_lifecycle).',
      );
    }

    if (!agencyClientId) {
      return {
        ok: true,
        lifecycle_id: lifecycleId,
        stage,
        agency_client_id: null,
        linked: false,
        period: { from: dateFrom, to: dateTo, weeks, month_start: monthStart },
        tiles: {
          spend_mtd_vnd: 0,
          leads_mtd: 0,
          cpl_mtd: null,
          roas_mtd: null,
          roas_stub: false,
        },
        targets: { cpl_vnd: null, roas: null, source: 'none' },
        trend: [],
        deltas: { cpl_vs_target_pct: null, spend_vs_prev_week_pct: null },
        flags: { perf_tables_ready: false },
        messages: [
          ...contextMessages,
          'HĐ chưa liên kết agency client — gán agency_client_id trên hợp đồng trước.',
        ],
      };
    }

    try {
      const perf = await this.performance.listForClient(agencyClientId, {
        from: dateFrom,
        to: dateTo,
        group_by: 'day',
        channel: opts.channel ?? 'meta',
      });

      const rows = perf.rows ?? [];
      const targets = buildDashboardTargets(rows);
      const tiles = buildDashboardTiles(rows, monthStart, dateTo);
      const trend = buildDashboardTrend(rows, weeks, dateTo);
      const deltas = buildDashboardDeltas(trend, targets);

      const messages: string[] = [...contextMessages];
      if (rows.length === 0) {
        messages.push(
          'Chưa có daily_performance — chạy sync Meta insights hoặc mở tab Performance agency client.',
        );
      }
      if (tiles.roas_stub) {
        messages.push('ROAS đang ước tính (stub) — cần conversion value thật để tin cậy.');
      }

      return {
        ok: true,
        lifecycle_id: lifecycleId,
        stage,
        agency_client_id: agencyClientId,
        linked: true,
        period: { from: dateFrom, to: dateTo, weeks, month_start: monthStart },
        tiles,
        targets,
        trend,
        deltas,
        flags: { perf_tables_ready: true },
        messages,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        return {
          ok: true,
          lifecycle_id: lifecycleId,
          stage,
          agency_client_id: agencyClientId,
          linked: true,
          period: { from: dateFrom, to: dateTo, weeks, month_start: monthStart },
          tiles: {
            spend_mtd_vnd: 0,
            leads_mtd: 0,
            cpl_mtd: null,
            roas_mtd: null,
            roas_stub: false,
          },
          targets: { cpl_vnd: null, roas: null, source: 'none' },
          trend: [],
          deltas: { cpl_vs_target_pct: null, spend_vs_prev_week_pct: null },
          flags: { perf_tables_ready: false },
          messages: ['Bảng performance chưa sẵn sàng trên PostgreSQL.'],
        };
      }
      throw err;
    }
  }
}
