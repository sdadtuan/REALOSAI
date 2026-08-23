import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { computeDealScoreV1 } from './deal-score.engine';
import {
  DEAL_SCORE_MODEL,
  DEAL_SCORE_MODEL_VERSION,
  ScoreDealRequest,
  ScoreDealResponse,
} from './deal-score.types';
import { AiScoreRecord } from './lead-score.types';
import { AiScoresRepository } from './ai-scores.repository';

@Injectable()
export class AiDealScoreService {
  constructor(
    private readonly scores: AiScoresRepository,
    private readonly contextRepo: DealScoreContextRepository,
    private readonly audit: AiAuditService,
  ) {}

  async scoreDeal(input: ScoreDealRequest): Promise<ScoreDealResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_scores_not_ready',
        message: 'Apply RNOS-01 DDL before scoring deals',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const entityId = String(input.dealId);

    if (!input.force) {
      const recent = await this.scores.findRecentAutoScore('deal', entityId, 'deal');
      if (recent) {
        return this.toResponse(recent, input.dealId, requestId, true);
      }
    }

    const ctx = await this.contextRepo.loadDealScoreContext(input.dealId);
    if (!ctx) {
      throw new NotFoundException({ error: 'deal_not_found', deal_id: input.dealId });
    }

    const engineResult = computeDealScoreV1(ctx);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.SCORE_DEAL,
        entityType: 'deal',
        entityId,
        clientId: input.clientId ?? ctx.clientId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: DEAL_SCORE_MODEL,
        input: {
          deal_id: input.dealId,
          pipeline_stage: ctx.pipelineStage,
          features: engineResult.features,
        },
      },
      async () => ({
        data: engineResult,
        output: {
          score: engineResult.score,
          confidence: engineResult.confidence,
          score_band: engineResult.explainability.score_band,
        },
        modelName: DEAL_SCORE_MODEL,
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const row = await this.scores.insertScore({
      clientId: input.clientId ?? ctx.clientId,
      entityType: 'deal',
      entityId,
      scoreType: 'deal',
      scoreValue: wrapped.data.score,
      confidence: wrapped.data.confidence,
      features: wrapped.data.features,
      explainability: wrapped.data.explainability,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(row, input.dealId, requestId, false, wrapped.runId);
  }

  async listDealScoresBatch(
    dealIds: number[],
    requestId?: string,
  ): Promise<Record<string, AiScoreRecord>> {
    if (!(await this.scores.tableReady())) {
      return {};
    }
    const ids = [...new Set(dealIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
    const rows = await this.scores.listLatestForEntities('deal', ids.map(String));
    const out: Record<string, AiScoreRecord> = {};
    for (const row of rows) {
      if (row.score_type === 'deal') {
        out[row.entity_id] = row;
      }
    }
    return out;
  }

  private toResponse(
    row: AiScoreRecord,
    dealId: number,
    requestId: string,
    cached: boolean,
    agentRunId?: string,
  ): ScoreDealResponse {
    const explain = row.explainability_json ?? { factors: [], flags: [], score_band: 'warm' as const };
    return {
      data: {
        deal_id: dealId,
        score: row.score_value,
        confidence: row.confidence ?? 0,
        score_band: explain.score_band ?? 'warm',
        explainability: explain,
        cached,
        agent_run_id: agentRunId ?? row.agent_run_id ?? '',
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
