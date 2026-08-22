import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { sumReceivedRevenueForRange } from '../finance/forecast-actual.util';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { buildForecastDealRow, computeRevenueForecastV1 } from './forecast.engine';
import {
  ForecastCommitRequest,
  ForecastCommitResponse,
  ForecastDashboardData,
  ForecastDashboardResponse,
  ForecastMapePriorMonth,
  ForecastMapeReportData,
  ForecastMapeReportResponse,
  ForecastMapeReportRow,
  ForecastSnapshotRequest,
  ForecastSnapshotResponse,
  ForecastVarianceData,
  ForecastVarianceResponse,
} from './forecast.types';
import { RevenueForecastRepository } from './revenue-forecast.repository';

const MAPE_WARN_THRESHOLD = 20;

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodLabel(year: number, month: number): string {
  return `Tháng ${month}/${year}`;
}

function priorMonth(year: number, month: number): { year: number; month: number; label: string } {
  const d = new Date(year, month - 2, 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
  };
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const endDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
}

@Injectable()
export class AiForecastService {
  private sqlite: DatabaseSync | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly crmConfig: CrmConfigService,
    private readonly audit: AiAuditService,
    private readonly dealContext: DealScoreContextRepository,
    private readonly snapshots: RevenueForecastRepository,
  ) {}

  private get database(): DatabaseSync {
    if (!this.sqlite) {
      this.sqlite = new DatabaseSync(this.config.sqlitePath);
      this.sqlite.exec('PRAGMA foreign_keys = ON');
    }
    return this.sqlite;
  }

  async generateSnapshot(input: ForecastSnapshotRequest = {}): Promise<ForecastSnapshotResponse> {
    if (!(await this.snapshots.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'revenue_forecast_snapshots_not_ready',
        message: 'Apply RNOS-01 DDL before forecast snapshot',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const snapshotDate = input.snapshotDate?.trim() || todayYmd();
    const now = new Date(`${snapshotDate}T12:00:00`);

    if (!input.force) {
      const existing = await this.snapshots.findBySnapshotDate(snapshotDate);
      if (existing) {
        return {
          data: {
            snapshot_id: existing.id,
            snapshot_date: existing.snapshot_date,
            pipeline_amount: existing.pipeline_amount,
            forecast_amount: existing.forecast_amount,
            ai_adjustment: Number(existing.ai_adjustment ?? 0),
            best_case_amount: existing.best_case_amount,
            stalled_deal_count: Number(existing.metadata.stalled_deal_count ?? 0),
            skipped: true,
            agent_run_id: existing.agent_run_id ?? '',
            scanned_at: existing.created_at,
          },
          meta: { request_id: requestId },
          errors: [],
        };
      }
    } else {
      await this.snapshots.deleteUncommittedOrgSnapshotForDate(snapshotDate);
    }

    const dealIds = this.dealContext.listOpenDealIds(500);
    const runtime = this.crmConfig.toPipelineRuntime();
    const deals = dealIds
      .map((id) => this.dealContext.loadDealScoreContext(id))
      .filter((ctx) => ctx && !ctx.isTerminal)
      .map((ctx) => buildForecastDealRow(ctx!));

    const computed = computeRevenueForecastV1({
      deals,
      stageLabels: runtime.labels,
      month: now.getMonth() + 1,
      now,
    });

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.FORECAST_SNAPSHOT,
        entityType: 'forecast',
        entityId: snapshotDate,
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'revenue-forecast-v1',
        input: {
          snapshot_date: snapshotDate,
          deal_count: deals.length,
          pipeline_amount: computed.pipeline_amount,
        },
      },
      async () => {
        const row = await this.snapshots.insertSnapshot({
          snapshotDate,
          pipelineAmount: computed.pipeline_amount,
          forecastAmount: computed.forecast_amount,
          aiAdjustment: computed.ai_adjustment,
          bestCaseAmount: computed.best_case_amount,
          confidenceScore: computed.confidence_score,
          metadata: {
            stalled_deal_count: computed.stalled_deal_count,
            factors: computed.factors,
            stage_buckets: computed.stage_buckets,
            summary_note: computed.summary_note,
            deal_count: deals.length,
          },
          agentRunId: null,
        });

        return {
          data: {
            snapshot_id: row.id,
            snapshot_date: row.snapshot_date,
            pipeline_amount: row.pipeline_amount,
            forecast_amount: row.forecast_amount,
            ai_adjustment: Number(row.ai_adjustment ?? 0),
            best_case_amount: row.best_case_amount,
            stalled_deal_count: computed.stalled_deal_count,
            skipped: false,
            agent_run_id: '',
            scanned_at: row.created_at,
          },
          output: {
            snapshot_id: row.id,
            forecast_amount: row.forecast_amount,
            stalled_deal_count: computed.stalled_deal_count,
          },
        };
      },
    );

    const data = wrapped.data;
    data.agent_run_id = wrapped.runId;
    return { data, meta: { request_id: requestId }, errors: [] };
  }

  async getDashboard(year?: number, month?: number, correlationId?: string): Promise<ForecastDashboardResponse> {
    if (!(await this.snapshots.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'revenue_forecast_snapshots_not_ready',
        message: 'Apply RNOS-01 DDL before forecast dashboard',
      });
    }

    const now = new Date();
    const y = year && Number.isFinite(year) ? year : now.getFullYear();
    const m = month && Number.isFinite(month) ? month : now.getMonth() + 1;
    const requestId = correlationId?.trim() || this.audit.newRequestId();

    const snapshot = await this.snapshots.findLatestInMonth(y, m);
    const prior = priorMonth(y, m);
    const priorRange = monthRange(prior.year, prior.month);
    const actualPrior = sumReceivedRevenueForRange(this.database, priorRange.start, priorRange.end);
    const mapePrior = await this.buildMapePriorMonth(prior.year, prior.month, actualPrior);

    const metadata = snapshot?.metadata ?? {};
    const factors = (metadata.factors as ForecastDashboardData['factors']) ?? [];
    const stageBuckets = (metadata.stage_buckets as ForecastDashboardData['stage_buckets']) ?? [];

    const data: ForecastDashboardData = {
      year: y,
      month: m,
      period_label: periodLabel(y, m),
      snapshot,
      pipeline_amount: snapshot?.pipeline_amount ?? 0,
      forecast_amount: snapshot?.forecast_amount ?? 0,
      ai_adjustment: Number(snapshot?.ai_adjustment ?? 0),
      committed_amount: snapshot?.committed_amount ?? 0,
      best_case_amount: snapshot?.best_case_amount ?? 0,
      actual_prior_month_vnd: actualPrior,
      stalled_deal_count: Number(metadata.stalled_deal_count ?? 0),
      factors,
      stage_buckets: stageBuckets,
      summary_note: String(metadata.summary_note ?? 'Chưa có snapshot — cron RNOS-17 chạy hàng ngày lúc 07:00 ICT.'),
      mape_prior_month: mapePrior,
      can_commit: Boolean(snapshot && !snapshot.committed_at),
      is_committed: Boolean(snapshot?.committed_at),
    };

    return { data, meta: { request_id: requestId }, errors: [] };
  }

  async commitForecast(input: ForecastCommitRequest): Promise<ForecastCommitResponse> {
    if (!(await this.snapshots.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'revenue_forecast_snapshots_not_ready',
        message: 'Apply RNOS-01 DDL before forecast commit',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const amount = Number(input.committedAmountVnd);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException({
        error: 'invalid_committed_amount',
        message: 'committed_amount_vnd must be a non-negative number',
      });
    }

    const snapshotId = input.snapshotId?.trim();
    if (!snapshotId) {
      throw new BadRequestException({ error: 'missing_snapshot_id', message: 'snapshot_id is required' });
    }

    const dashboard = await this.getDashboard(undefined, undefined, requestId);
    const mape = dashboard.data.mape_prior_month;
    if (mape?.warn && !input.acknowledgeMapeWarning) {
      throw new ConflictException({
        error: 'mape_warning',
        message: `MAPE tháng trước ${mape.mape_pct?.toFixed(1)}% > ${MAPE_WARN_THRESHOLD}% — cần xác nhận trước khi cam kết`,
        mape_prior_month: mape,
      });
    }

    const committedBy = input.actorEmail?.trim() || input.actorId?.trim() || 'gdkd';
    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.FORECAST_COMMIT,
        entityType: 'forecast',
        entityId: snapshotId,
        actorId: input.actorId ?? committedBy,
        correlationId: requestId,
        modelName: 'revenue-forecast-v1',
        input: { snapshot_id: snapshotId, committed_amount_vnd: amount },
      },
      async () => {
        const row = await this.snapshots.commitSnapshot({
          snapshotId,
          committedAmount: amount,
          committedBy,
        });
        if (!row) {
          throw new ConflictException({
            error: 'already_committed',
            message: 'Snapshot đã được cam kết — không thể sửa',
          });
        }
        return {
          data: {
            snapshot_id: row.id,
            committed_amount: row.committed_amount,
            committed_by: row.committed_by ?? committedBy,
            committed_at: row.committed_at ?? new Date().toISOString(),
          },
          output: {
            committed_amount: row.committed_amount,
            committed_by: row.committed_by,
          },
        };
      },
    );

    return { data: wrapped.data, meta: { request_id: requestId }, errors: [] };
  }

  /** AI-UC-013 step 7 — leadership variance committed vs actual T-1. */
  async getForecastVariance(correlationId?: string): Promise<ForecastVarianceResponse> {
    const dashboard = await this.getDashboard(undefined, undefined, correlationId);
    const mape = dashboard.data.mape_prior_month;
    const requestId = dashboard.meta.request_id;
    const committed = mape?.committed_vnd ?? 0;
    const actual = mape?.actual_vnd ?? dashboard.data.actual_prior_month_vnd ?? 0;
    const varianceVnd = committed - actual;
    let variancePct: number | null = null;
    if (actual > 0) {
      variancePct = Math.round((varianceVnd / actual) * 1000) / 10;
    }

    const data: ForecastVarianceData = {
      period_label: mape?.month ?? 'Tháng trước',
      committed_vnd: committed,
      actual_vnd: actual,
      variance_vnd: varianceVnd,
      variance_pct: variancePct,
      mape_pct: mape?.mape_pct ?? null,
      warn: Boolean(mape?.warn),
    };

    return { data, meta: { request_id: requestId }, errors: [] };
  }

  /** §19.3 #2 — rolling MAPE report for leadership. */
  async getMapeReport(months = 6, correlationId?: string): Promise<ForecastMapeReportResponse> {
    if (!(await this.snapshots.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'revenue_forecast_snapshots_not_ready',
        message: 'Apply RNOS-01 DDL before MAPE report',
      });
    }

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const cappedMonths = Math.min(Math.max(months, 1), 12);
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    const rows: ForecastMapeReportRow[] = [];

    for (let i = 0; i < cappedMonths; i += 1) {
      const prior = priorMonth(y, m);
      const range = monthRange(prior.year, prior.month);
      const actual = sumReceivedRevenueForRange(this.database, range.start, range.end);
      const mapeRow = await this.buildMapePriorMonth(prior.year, prior.month, actual);
      const committed = await this.snapshots.findCommittedForMonth(prior.year, prior.month);
      const committedVnd = mapeRow?.committed_vnd ?? 0;
      rows.push({
        year: prior.year,
        month: prior.month,
        period_label: prior.label,
        committed_vnd: committedVnd,
        actual_vnd: actual,
        variance_vnd: committedVnd - actual,
        mape_pct: mapeRow?.mape_pct ?? null,
        warn: Boolean(mapeRow?.warn),
        committed_by: committed?.committed_by ?? null,
        committed_at: committed?.committed_at ?? null,
      });
      y = prior.year;
      m = prior.month;
    }

    const mapeValues = rows.map((row) => row.mape_pct).filter((v): v is number => v != null);
    const avgMape =
      mapeValues.length > 0
        ? Math.round((mapeValues.reduce((a, b) => a + b, 0) / mapeValues.length) * 10) / 10
        : null;

    const data: ForecastMapeReportData = {
      generated_at: new Date().toISOString(),
      months: cappedMonths,
      target_mape_pct: MAPE_WARN_THRESHOLD,
      rows,
      summary: {
        avg_mape_pct: avgMape,
        months_over_target: rows.filter((row) => row.warn).length,
      },
    };

    return { data, meta: { request_id: requestId }, errors: [] };
  }

  private async buildMapePriorMonth(
    year: number,
    month: number,
    actualVnd: number,
  ): Promise<ForecastMapePriorMonth | null> {
    const committed = await this.snapshots.findCommittedForMonth(year, month);
    if (!committed) {
      return {
        month: periodLabel(year, month),
        committed_vnd: 0,
        actual_vnd: actualVnd,
        mape_pct: null,
        warn: false,
      };
    }

    const committedVnd = committed.committed_amount;
    let mapePct: number | null = null;
    if (actualVnd > 0) {
      mapePct = Math.round((Math.abs(committedVnd - actualVnd) / actualVnd) * 1000) / 10;
    }

    return {
      month: periodLabel(year, month),
      committed_vnd: committedVnd,
      actual_vnd: actualVnd,
      mape_pct: mapePct,
      warn: mapePct != null && mapePct > MAPE_WARN_THRESHOLD,
    };
  }
}
