import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAuditService } from '../ai-intelligence/ai-audit.service';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PerformanceService } from '../performance/performance.service';
import { PerformanceRow } from '../performance/performance.types';
import { computeCpl, formatDateOnly, resolveDateWindow } from '../performance/performance.util';
import { buildPortalReportSummary } from './portal-report-summary.engine';
import {
  PortalAiReportSummaryResponse,
  PortalReportChannelKpi,
  PortalReportSummaryKpis,
} from './portal-ai-report.types';

@Injectable()
export class PortalAiReportService {
  constructor(
    private readonly performance: PerformanceService,
    private readonly audit: AiAuditService,
  ) {}

  private portalAiSummaryEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_PORTAL_AI_SUMMARY_ENABLED ?? '0').trim().toLowerCase(),
    );
  }

  private normalizeDays(raw: string | undefined): number {
    const parsed = Number.parseInt(String(raw ?? '7'), 10);
    if (!Number.isFinite(parsed)) {
      return 7;
    }
    return Math.min(30, Math.max(1, parsed));
  }

  private aggregateChannels(rows: PerformanceRow[]): PortalReportChannelKpi[] {
    const buckets = new Map<'meta' | 'google' | 'zalo', { spend: number; leads: number }>();
    for (const row of rows) {
      const channel = String(row.channel ?? '').trim().toLowerCase();
      if (channel !== 'meta' && channel !== 'google' && channel !== 'zalo') {
        continue;
      }
      const current = buckets.get(channel) ?? { spend: 0, leads: 0 };
      current.spend += row.spend;
      current.leads += row.leads_crm;
      buckets.set(channel, current);
    }
    return (['meta', 'google', 'zalo'] as const)
      .map((channel) => {
        const bucket = buckets.get(channel);
        if (!bucket || (bucket.spend <= 0 && bucket.leads <= 0)) {
          return null;
        }
        return {
          channel,
          spend: bucket.spend,
          leads_crm: bucket.leads,
          avg_cpl: computeCpl(bucket.spend, bucket.leads),
        };
      })
      .filter((item): item is PortalReportChannelKpi => item != null);
  }

  private emptyKpis(): PortalReportSummaryKpis {
    return {
      total_spend: 0,
      total_leads_crm: 0,
      avg_cpl: null,
      avg_roas: null,
      campaigns_tracked: 0,
      over_target_rows: 0,
      unmapped_spend_pct: 0,
    };
  }

  async reportSummary(
    user: PortalJwtPayload,
    daysRaw?: string,
  ): Promise<PortalAiReportSummaryResponse> {
    const days = this.normalizeDays(daysRaw);
    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    if (!this.portalAiSummaryEnabled()) {
      const { start, end } = resolveDateWindow({}, days);
      const dateFrom = formatDateOnly(start);
      const dateTo = formatDateOnly(end);
      return {
        ok: true,
        client_id: user.client_id,
        enabled: false,
        period: {
          from: dateFrom,
          to: dateTo,
          days,
          label: `Tuần này (${dateFrom.slice(8, 10)}/${dateFrom.slice(5, 7)} → ${dateTo.slice(8, 10)}/${dateTo.slice(5, 7)})`,
        },
        narrative: '',
        bullets: [],
        kpis: this.emptyKpis(),
        channels: [],
        generated_at: generatedAt,
        stub_mode: true,
      };
    }

    const { start, end } = resolveDateWindow({}, days);
    const dateFrom = formatDateOnly(start);
    const dateTo = formatDateOnly(end);
    const periodLabel = `Tuần này (${dateFrom.slice(8, 10)}/${dateFrom.slice(5, 7)} → ${dateTo.slice(8, 10)}/${dateTo.slice(5, 7)})`;

    let performanceData;
    try {
      performanceData = await this.performance.listForClient(user.client_id, {
        from: dateFrom,
        to: dateTo,
        group_by: 'campaign',
      });
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      const errorCode =
        err instanceof ServiceUnavailableException
          ? String((err.getResponse() as { error?: string })?.error ?? 'performance_unavailable')
          : 'performance_unavailable';
      return {
        ok: true,
        client_id: user.client_id,
        enabled: true,
        period: { from: dateFrom, to: dateTo, label: periodLabel, days },
        narrative:
          'Chưa thể tạo tóm tắt AI vì dữ liệu performance chưa sẵn sàng. Bạn vẫn có thể xem bảng KPI chi tiết bên dưới.',
        bullets: [],
        kpis: this.emptyKpis(),
        channels: [],
        generated_at: generatedAt,
        stub_mode: true,
        error: errorCode,
      };
    }

    const summary = performanceData.summary;
    const kpis: PortalReportSummaryKpis = {
      total_spend: summary.total_spend,
      total_leads_crm: summary.total_leads_crm,
      avg_cpl: summary.avg_cpl,
      avg_roas: summary.avg_roas,
      campaigns_tracked: summary.campaigns_tracked,
      over_target_rows: summary.over_target_rows,
      unmapped_spend_pct: performanceData.unmapped_spend_pct,
    };
    const channels = this.aggregateChannels(performanceData.rows);

    const requestId = this.audit.newRequestId();
    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.PORTAL_REPORT_SUMMARY,
        entityType: 'portal_client',
        entityId: user.client_id,
        actorId: user.sub,
        correlationId: requestId,
        modelName: 'portal-report-summary-v1',
        input: { client_id: user.client_id, days, date_from: dateFrom, date_to: dateTo },
      },
      async () => {
        const snapshot = buildPortalReportSummary({
          client_id: user.client_id,
          period: { from: dateFrom, to: dateTo, label: periodLabel, days },
          kpis,
          channels,
          data_freshness: performanceData.data_freshness,
        });
        return {
          data: snapshot,
          output: {
            narrative_length: snapshot.narrative.length,
            bullet_count: snapshot.bullets.length,
          },
        };
      },
    );

    return {
      ok: true,
      client_id: user.client_id,
      enabled: true,
      period: { from: dateFrom, to: dateTo, label: periodLabel, days },
      narrative: wrapped.data.narrative,
      bullets: wrapped.data.bullets,
      kpis,
      channels,
      data_freshness: performanceData.data_freshness,
      generated_at: generatedAt,
      stub_mode: true,
      agent_run_id: wrapped.runId,
    };
  }
}
