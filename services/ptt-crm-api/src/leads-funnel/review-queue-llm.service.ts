import { Injectable } from '@nestjs/common';
import { AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAuditService } from '../ai-intelligence/ai-audit.service';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import {
  buildReviewQueueLlmPrompt,
  computeReviewQueuePriority,
  type ReviewQueueAiSummary,
} from './review-queue-intelligence.util';
import {
  buildReviewQueueTriageStub,
  parseReviewQueueLlmOutput,
  reviewQueueTriageSystemPrompt,
} from './review-queue-llm.util';

export interface ReviewQueueLlmContextRow {
  lead_id: number;
  full_name: string;
  status: string;
  hours_waiting: number | null;
  owner_name: string | null;
  best_owner_name: string | null;
}

@Injectable()
export class ReviewQueueLlmService {
  constructor(
    private readonly llm: AiLlmClient,
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  async enrichSummaries(
    rulesSummaries: ReviewQueueAiSummary[],
    contextRows: ReviewQueueLlmContextRow[],
  ): Promise<{ ok: true; summaries: ReviewQueueAiSummary[]; total: number; mode: 'llm' }> {
    const withRulesPriority = rulesSummaries.map((summary) => {
      const ctx = contextRows.find((row) => row.lead_id === summary.lead_id);
      return {
        ...summary,
        priority_score: computeReviewQueuePriority(ctx?.hours_waiting),
        triage_source: 'rules' as const,
      };
    });

    if (!this.aiConfig.copilotEnabled || withRulesPriority.length === 0) {
      return { ok: true, summaries: withRulesPriority, total: withRulesPriority.length, mode: 'llm' };
    }

    const promptItems = withRulesPriority.map((summary) => {
      const ctx = contextRows.find((row) => row.lead_id === summary.lead_id);
      return {
        lead_id: summary.lead_id,
        full_name: ctx?.full_name ?? '',
        status: ctx?.status ?? '',
        hours_waiting: ctx?.hours_waiting ?? null,
        root_cause: summary.root_cause,
        owner_name: ctx?.owner_name ?? null,
        best_owner_name: ctx?.best_owner_name ?? null,
        rules_summary: summary.summary_line,
      };
    });

    const userContent = buildReviewQueueLlmPrompt(promptItems);
    const leadIds = withRulesPriority.map((s) => s.lead_id);

    try {
      const wrapped = await this.audit.wrap(
        {
          useCase: AI_USE_CASE.REVIEW_QUEUE_TRIAGE,
          entityType: 'review_queue',
          entityId: leadIds.slice(0, 5).join(',') || 'batch',
          correlationId: this.audit.newRequestId(),
          modelName: this.aiConfig.llmModel,
          input: { lead_ids: leadIds, count: leadIds.length },
        },
        async () => {
          const result = await this.llm.reviewQueueTriageStructured({
            systemPrompt: reviewQueueTriageSystemPrompt(),
            userContent,
          });
          const summaries =
            result.stubMode
              ? buildReviewQueueTriageStub(withRulesPriority)
              : parseReviewQueueLlmOutput(result.parsed as Record<string, unknown>, withRulesPriority);
          return {
            data: summaries,
            output: { items: summaries.length, stub: result.stubMode },
            modelName: result.modelName,
            tokenUsage: result.tokenUsage,
          };
        },
      );

      return {
        ok: true,
        summaries: wrapped.data as ReviewQueueAiSummary[],
        total: (wrapped.data as ReviewQueueAiSummary[]).length,
        mode: 'llm',
      };
    } catch {
      return { ok: true, summaries: withRulesPriority, total: withRulesPriority.length, mode: 'llm' };
    }
  }
}
