import { Injectable } from '@nestjs/common';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiSummarizeService } from './ai-summarize.service';
import { ScoreLeadResponse } from './lead-score.types';
import { AiAuditContext } from './ai-intelligence.types';
import { SummarizeRequest, SummarizeResponse } from './summarize.types';

/**
 * RNOS-05 — audited execution entry points.
 */
@Injectable()
export class AiExecutionService {
  constructor(
    private readonly leadScore: AiLeadScoreService,
    private readonly summarizeService: AiSummarizeService,
    private readonly timeline: CustomerTimelineService,
  ) {}

  /** RNOS-04 — score lead via rules engine (worker + API). */
  scoreLead(
    ctx: Omit<AiAuditContext, 'useCase'>,
    leadId: string | number,
    options?: { force?: boolean },
  ): Promise<ScoreLeadResponse> {
    return this.leadScore.scoreLead({
      leadId: Number(leadId),
      force: options?.force,
      actorId: ctx.actorId ?? null,
      correlationId: ctx.correlationId ?? null,
      clientId: ctx.clientId ?? null,
    });
  }

  /** RNOS-03 — summarize activity or lead brief. */
  summarize(input: SummarizeRequest): Promise<SummarizeResponse> {
    return this.summarizeService.summarize(input);
  }

  /** @deprecated use summarize() */
  async summarizeStub(
    ctx: Omit<AiAuditContext, 'useCase'>,
    text: string,
    entityType?: string,
    entityId?: string,
  ): Promise<SummarizeResponse> {
    return this.summarizeService.summarize({
      context: 'activity',
      text,
      entityType,
      entityId,
      actorId: ctx.actorId ?? null,
      correlationId: ctx.correlationId ?? null,
      clientId: ctx.clientId ?? null,
    });
  }
}
