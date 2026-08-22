import { BadRequestException, Injectable } from '@nestjs/common';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiChurnHealthService } from './ai-churn-health.service';
import { AiForecastService } from './ai-forecast.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { listNlQueryCatalog } from './nl-query.catalog';
import { resolveIntent, toResultPayload } from './nl-query.engine';
import { NlQueryContextRepository } from './nl-query-context.repository';
import {
  NlQueryCatalogResponse,
  NlQueryExecutionResult,
  NlQueryRunRequest,
  NlQueryRunResponse,
} from './nl-query.types';
import { PipelineRiskService } from './pipeline-risk.service';

@Injectable()
export class AiNlQueryService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly context: NlQueryContextRepository,
    private readonly cskhBoard: CskhBoardService,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly forecast: AiForecastService,
    private readonly churnHealth: AiChurnHealthService,
  ) {}

  getCatalog(correlationId?: string): NlQueryCatalogResponse {
    const intents = listNlQueryCatalog();
    return {
      data: { intents, total: intents.length },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  async runQuery(input: NlQueryRunRequest): Promise<NlQueryRunResponse> {
    const intent = resolveIntent({
      intent_id: input.intent_id,
      question: input.question,
    });
    if (!intent) {
      throw new BadRequestException({
        error: 'query_out_of_scope',
        message: 'Câu hỏi ngoài phạm vi — chọn từ danh sách preset.',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.NL_QUERY,
        entityType: 'nl_query',
        entityId: intent.id,
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'nl-query-curated-v1',
        input: {
          intent_id: intent.id,
          question: input.question ?? null,
        },
      },
      async () => {
        const execution = await this.executeIntent(intent.id);
        const payload = toResultPayload(intent, execution);
        return {
          data: payload,
          output: {
            intent_id: intent.id,
            row_count: payload.rows.length,
            result_kind: payload.result_kind,
          },
        };
      },
    );

    return {
      data: wrapped.data,
      meta: { request_id: requestId, agent_run_id: wrapped.runId },
      errors: [],
    };
  }

  private async executeIntent(intentId: string): Promise<NlQueryExecutionResult> {
    switch (intentId) {
      case 'sla_breach_summary':
        return this.slaBreachSummary();
      case 'sla_breach_top':
        return this.slaBreachTop();
      case 'pipeline_at_risk_count':
        return this.pipelineAtRiskCount();
      case 'pipeline_at_risk_top':
        return this.pipelineAtRiskTop();
      case 'ai_acceptance_7d':
        return this.aiAcceptance7d();
      case 'ai_dismiss_reasons_7d':
        return this.aiDismissReasons7d();
      case 'forecast_month_summary':
        return this.forecastMonthSummary();
      case 'revenue_forecast_gap':
      case 'forecast_pipeline_coverage':
      case 'forecast_committed_gap':
        return this.forecastGap(intentId);
      case 'churn_health_top10':
        return this.churnHealthTop10();
      case 'health_at_risk_count':
      case 'health_ticket_spike_count':
      case 'health_payment_overdue_count':
        return this.healthCount(intentId);
      case 'cskh_open_board':
        return this.cskhOpenBoard();
      case 'ops_sla_warning':
        return this.slaWarning();
      case 'ai_recommendations_pending':
        return this.aiRecommendationsPending();
      default:
        return this.context.executeSqliteIntent(intentId);
    }
  }

  private async slaBreachSummary(): Promise<NlQueryExecutionResult> {
    const board = await this.cskhBoard.getBoard({ sla_filter: 'all', limit: 500, offset: 0 });
    return {
      columns: [
        { key: 'breach', label: 'Breach', type: 'number' },
        { key: 'warning', label: 'Warning', type: 'number' },
        { key: 'ok', label: 'OK', type: 'number' },
        { key: 'total', label: 'Tổng', type: 'number' },
      ],
      rows: [
        {
          breach: board.summary.breach,
          warning: board.summary.warning,
          ok: board.summary.ok,
          total: board.summary.total,
        },
      ],
      drill_href: '/crm/cskh-board?sla_filter=breach',
    };
  }

  private async slaBreachTop(): Promise<NlQueryExecutionResult> {
    const board = await this.cskhBoard.getBoard({ sla_filter: 'breach', limit: 20, offset: 0 });
    return {
      columns: [
        { key: 'lead_id', label: 'Lead ID', type: 'number' },
        { key: 'customer_name', label: 'Khách', type: 'string' },
        { key: 'owner_name', label: 'Owner', type: 'string' },
        { key: 'sla_state', label: 'SLA', type: 'string' },
        { key: 'sla_minutes_elapsed', label: 'Phút', type: 'number' },
      ],
      rows: board.items.map((row) => ({
        lead_id: row.id,
        customer_name: row.full_name,
        owner_name: row.owner_name,
        sla_state: row.sla_state,
        sla_minutes_elapsed: row.sla_minutes_elapsed,
      })),
      drill_href: '/crm/cskh-board?sla_filter=breach',
    };
  }

  private async pipelineAtRiskCount(): Promise<NlQueryExecutionResult> {
    try {
      const risk = await this.pipelineRisk.listAtRiskDeals(1, 0);
      return {
        columns: [
          { key: 'metric', label: 'Chỉ số', type: 'string' },
          { key: 'total', label: 'Giá trị', type: 'number' },
        ],
        rows: [{ metric: 'Deal at-risk', total: risk.data.total }],
        drill_href: '/crm/ai/insights?status=pending',
      };
    } catch {
      return {
        columns: [
          { key: 'metric', label: 'Chỉ số', type: 'string' },
          { key: 'total', label: 'Giá trị', type: 'number' },
        ],
        rows: [{ metric: 'Deal at-risk', total: 0 }],
        drill_href: '/crm/ai/insights',
      };
    }
  }

  private async pipelineAtRiskTop(): Promise<NlQueryExecutionResult> {
    try {
      const risk = await this.pipelineRisk.listAtRiskDeals(10, 0);
      return {
        columns: [
          { key: 'deal_id', label: 'Deal', type: 'number' },
          { key: 'title', label: 'Tiêu đề', type: 'string' },
          { key: 'pipeline_stage', label: 'Stage', type: 'string' },
          { key: 'stalled_days', label: 'Treo (ngày)', type: 'number' },
          { key: 'deal_score', label: 'Score', type: 'number' },
        ],
        rows: risk.data.deals.map((deal) => ({
          deal_id: deal.deal_id,
          title: deal.title,
          pipeline_stage: deal.pipeline_stage,
          stalled_days: deal.stalled_days,
          deal_score: deal.deal_score,
        })),
        drill_href: '/crm/ai/insights?status=pending',
      };
    } catch {
      return {
        columns: [
          { key: 'deal_id', label: 'Deal', type: 'number' },
          { key: 'title', label: 'Tiêu đề', type: 'string' },
        ],
        rows: [],
        drill_href: '/crm/ai/insights',
      };
    }
  }

  private async aiAcceptance7d(): Promise<NlQueryExecutionResult> {
    if (!(await this.recommendations.tableReady())) {
      return {
        columns: [
          { key: 'acceptance_rate_pct', label: 'Tỷ lệ %', type: 'pct' },
          { key: 'accepted', label: 'Chấp nhận', type: 'number' },
          { key: 'dismissed', label: 'Bỏ', type: 'number' },
          { key: 'pending', label: 'Chờ', type: 'number' },
        ],
        rows: [{ acceptance_rate_pct: null, accepted: 0, dismissed: 0, pending: 0 }],
        drill_href: '/crm/ai/insights',
      };
    }
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const metrics = await this.recommendations.getAcceptanceMetrics({ from, to });
    return {
      columns: [
        { key: 'acceptance_rate_pct', label: 'Tỷ lệ %', type: 'pct' },
        { key: 'accepted', label: 'Chấp nhận', type: 'number' },
        { key: 'dismissed', label: 'Bỏ', type: 'number' },
        { key: 'pending', label: 'Chờ', type: 'number' },
      ],
      rows: [
        {
          acceptance_rate_pct: metrics.acceptance_rate_pct,
          accepted: metrics.accepted,
          dismissed: metrics.dismissed,
          pending: metrics.pending,
        },
      ],
      drill_href: '/crm/ai/insights?status=accepted',
    };
  }

  private async aiDismissReasons7d(): Promise<NlQueryExecutionResult> {
    if (!(await this.recommendations.tableReady())) {
      return {
        columns: [
          { key: 'reason', label: 'Lý do', type: 'string' },
          { key: 'count', label: 'Số lần', type: 'number' },
        ],
        rows: [],
        drill_href: '/crm/ai/insights?status=dismissed',
      };
    }
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const metrics = await this.recommendations.getAcceptanceMetrics({ from, to });
    return {
      columns: [
        { key: 'reason', label: 'Lý do', type: 'string' },
        { key: 'count', label: 'Số lần', type: 'number' },
      ],
      rows: metrics.top_dismiss_reasons.map((row) => ({
        reason: row.reason,
        count: row.count,
      })),
      drill_href: '/crm/ai/insights?status=dismissed',
    };
  }

  private async forecastMonthSummary(): Promise<NlQueryExecutionResult> {
    try {
      const dash = await this.forecast.getDashboard();
      const d = dash.data;
      return {
        columns: [
          { key: 'period_label', label: 'Kỳ', type: 'string' },
          { key: 'pipeline_amount', label: 'Pipeline', type: 'currency' },
          { key: 'forecast_amount', label: 'Forecast', type: 'currency' },
          { key: 'committed_amount', label: 'Committed', type: 'currency' },
          { key: 'summary_note', label: 'Ghi chú', type: 'string' },
        ],
        rows: [
          {
            period_label: d.period_label,
            pipeline_amount: d.pipeline_amount,
            forecast_amount: d.forecast_amount,
            committed_amount: d.committed_amount,
            summary_note: d.summary_note,
          },
        ],
        drill_href: '/crm/forecast',
      };
    } catch {
      return {
        columns: [
          { key: 'period_label', label: 'Kỳ', type: 'string' },
          { key: 'summary_note', label: 'Ghi chú', type: 'string' },
        ],
        rows: [
          {
            period_label: 'Tháng hiện tại',
            summary_note: 'Chưa có snapshot forecast — apply RNOS-01 DDL và cron RNOS-17.',
          },
        ],
        drill_href: '/crm/forecast',
      };
    }
  }

  private async churnHealthTop10(): Promise<NlQueryExecutionResult> {
    try {
      const dash = await this.churnHealth.getDashboard({
        sort: 'churn_risk',
        order: 'desc',
        limit: 10,
        offset: 0,
      });
      return {
        columns: [
          { key: 'client_code', label: 'Mã', type: 'string' },
          { key: 'client_name', label: 'Client', type: 'string' },
          { key: 'health_score', label: 'Score', type: 'number' },
          { key: 'churn_risk_pct', label: 'Churn %', type: 'pct' },
          { key: 'ticket_spike', label: 'Ticket spike', type: 'string' },
        ],
        rows: dash.data.clients.map((client) => ({
          client_code: client.client_code,
          client_name: client.client_name,
          health_score: client.health.health_score,
          churn_risk_pct: client.health.churn_risk_pct,
          ticket_spike: client.health.ticket_spike ? 'yes' : 'no',
        })),
        drill_href: '/crm/health',
      };
    } catch {
      return {
        columns: [
          { key: 'client_code', label: 'Mã', type: 'string' },
          { key: 'client_name', label: 'Client', type: 'string' },
        ],
        rows: [],
        drill_href: '/crm/health',
      };
    }
  }

  private async cskhOpenBoard(): Promise<NlQueryExecutionResult> {
    const board = await this.cskhBoard.getBoard({ sla_filter: 'open', limit: 1, offset: 0 });
    return {
      columns: [
        { key: 'metric', label: 'Chỉ số', type: 'string' },
        { key: 'count', label: 'Giá trị', type: 'number' },
      ],
      rows: [{ metric: 'Lead mở CSKH', count: board.summary.total }],
      drill_href: '/crm/cskh-board?sla_filter=open',
    };
  }

  private async slaWarning(): Promise<NlQueryExecutionResult> {
    const board = await this.cskhBoard.getBoard({ sla_filter: 'warning', limit: 1, offset: 0 });
    return {
      columns: [{ key: 'count', label: 'Lead SLA warning', type: 'number' }],
      rows: [{ count: board.summary.warning }],
      drill_href: '/crm/cskh-board?sla_filter=warning',
    };
  }

  private async aiRecommendationsPending(): Promise<NlQueryExecutionResult> {
    if (!(await this.recommendations.tableReady())) {
      return { columns: [{ key: 'pending', label: 'Đang chờ', type: 'number' }], rows: [{ pending: 0 }] };
    }
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const metrics = await this.recommendations.getAcceptanceMetrics({ from, to });
    return {
      columns: [{ key: 'pending', label: 'Đang chờ', type: 'number' }],
      rows: [{ pending: metrics.pending }],
      drill_href: '/crm/ai/insights?status=pending',
    };
  }

  private async forecastGap(intentId: string): Promise<NlQueryExecutionResult> {
    try {
      const dash = (await this.forecast.getDashboard()).data;
      const value =
        intentId === 'forecast_pipeline_coverage'
          ? dash.pipeline_amount > 0
            ? Math.round((dash.forecast_amount / dash.pipeline_amount) * 1000) / 10
            : null
          : dash.forecast_amount - dash.committed_amount;
      return {
        columns: [
          { key: 'period', label: 'Kỳ', type: 'string' },
          {
            key: 'value',
            label: intentId === 'forecast_pipeline_coverage' ? 'Độ phủ' : 'Chênh lệch',
            type: intentId === 'forecast_pipeline_coverage' ? 'pct' : 'currency',
          },
        ],
        rows: [{ period: dash.period_label, value }],
        drill_href: '/crm/forecast',
      };
    } catch {
      return { columns: [{ key: 'status', label: 'Trạng thái', type: 'string' }], rows: [{ status: 'Chưa có forecast' }] };
    }
  }

  private async healthCount(intentId: string): Promise<NlQueryExecutionResult> {
    try {
      const dash = await this.churnHealth.getDashboard({
        sort: 'churn_risk',
        order: 'desc',
        limit: 500,
        offset: 0,
      });
      const count = dash.data.clients.filter((client) => {
        if (intentId === 'health_ticket_spike_count') return client.health.ticket_spike;
        if (intentId === 'health_payment_overdue_count') {
          return client.health.signals.payment_overdue_count > 0;
        }
        return ['at_risk', 'critical'].includes(client.health.health_band);
      }).length;
      return {
        columns: [{ key: 'count', label: 'Client', type: 'number' }],
        rows: [{ count }],
        drill_href: '/crm/health',
      };
    } catch {
      return { columns: [{ key: 'count', label: 'Client', type: 'number' }], rows: [{ count: 0 }] };
    }
  }
}
