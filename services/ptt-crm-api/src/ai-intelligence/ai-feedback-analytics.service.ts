import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import {
  AiAcceptanceMetricsResponse,
  AiDismissReasonMetricsResponse,
  AiRecommendationInboxResponse,
} from './feedback-analytics.types';
import { RecommendationStatus } from './recommendation.types';

@Injectable()
export class AiFeedbackAnalyticsService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly recommendations: AiRecommendationsRepository,
  ) {}

  async getAcceptanceMetrics(
    query: { from?: string; to?: string; days?: number; recommendation_type?: string },
    correlationId?: string,
  ): Promise<AiAcceptanceMetricsResponse> {
    await this.assertReady();
    const { from, to } = this.resolveWindow(query);
    const metrics = await this.recommendations.getAcceptanceMetrics({
      from,
      to,
      recommendationType: query.recommendation_type?.trim() || undefined,
    });
    return {
      data: { ...metrics, from, to },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  async getDismissReasonMetrics(
    query: { from?: string; to?: string; days?: number; recommendation_type?: string },
    correlationId?: string,
  ): Promise<AiDismissReasonMetricsResponse> {
    const acceptance = await this.getAcceptanceMetrics(query, correlationId);
    return {
      data: {
        from: acceptance.data.from,
        to: acceptance.data.to,
        recommendation_type: query.recommendation_type?.trim() || null,
        dismissed: acceptance.data.dismissed,
        top_dismiss_reasons: acceptance.data.top_dismiss_reasons,
      },
      meta: acceptance.meta,
      errors: [],
    };
  }

  async listInbox(
    query: {
      status?: RecommendationStatus;
      from?: string;
      to?: string;
      days?: number;
      limit?: number;
      offset?: number;
    },
    correlationId?: string,
  ): Promise<AiRecommendationInboxResponse> {
    await this.assertReady();
    const { from, to } = this.resolveWindow(query);
    const { rows, total } = await this.recommendations.listRecent({
      status: query.status,
      from,
      to,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      data: {
        recommendations: rows.map((row) => ({
          id: row.id,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          recommendation_type: row.recommendation_type,
          recommendation_text: row.recommendation_text,
          status: row.status,
          dismissed_reason: row.dismissed_reason,
          accepted_by: row.accepted_by,
          accepted_at: row.accepted_at,
          confidence: row.confidence,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        total,
      },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  private resolveWindow(query: { from?: string; to?: string; days?: number }): {
    from: string;
    to: string;
  } {
    const to = query.to?.trim() || new Date().toISOString();
    if (query.from?.trim()) {
      return { from: query.from.trim(), to };
    }
    const days = Math.min(Math.max(Number(query.days ?? 7) || 7, 1), 90);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    return { from, to };
  }

  private async assertReady(): Promise<void> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'schema_not_ready',
        message: 'ai_recommendations table is not ready',
      });
    }
  }
}
