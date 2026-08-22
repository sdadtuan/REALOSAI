import { BadRequestException, Injectable } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-audit.constants';
import { AiLeadRouteService } from '../ai-lead-route.service';
import { AiLeadScoreService } from '../ai-lead-score.service';
import { AnomalyDigestService } from '../anomaly-digest.service';
import { BudgetRecommendService } from '../budget-recommend.service';
import { RenewalAgentService } from '../renewal-agent.service';
import { UpsellAgentService } from '../upsell-agent.service';
import {
  OrchestratorContext,
  OrchestratorStepKey,
  RegisteredAgent,
} from './orchestrator.types';

@Injectable()
export class AgentRegistry {
  private readonly agents: ReadonlyMap<OrchestratorStepKey, RegisteredAgent>;

  constructor(
    private readonly leadScore: AiLeadScoreService,
    private readonly leadRoute: AiLeadRouteService,
    private readonly renewal: RenewalAgentService,
    private readonly upsell: UpsellAgentService,
    private readonly anomaly: AnomalyDigestService,
    private readonly budgetRecommend: BudgetRecommendService,
  ) {
    this.agents = new Map<OrchestratorStepKey, RegisteredAgent>([
      [
        'score_lead',
        {
          agentName: 'lead-qualification',
          useCase: AI_USE_CASE.SCORE_LEAD,
          handler: (ctx, auditCtx) =>
            this.leadScore.scoreLead({
              leadId: this.requireLeadId(ctx),
              actorId: auditCtx.actorId ?? ctx.actorId,
              correlationId: auditCtx.correlationId ?? ctx.correlationId,
              clientId: auditCtx.clientId ?? ctx.clientId,
            }),
        },
      ],
      [
        'route_rep',
        {
          agentName: 'lead-routing',
          useCase: AI_USE_CASE.ROUTE_REP,
          handler: (ctx, auditCtx) =>
            this.leadRoute.suggestRouteRep({
              lead_id: this.requireLeadId(ctx),
              actorId: auditCtx.actorId ?? ctx.actorId,
              correlationId: auditCtx.correlationId ?? ctx.correlationId ?? undefined,
            }),
        },
      ],
      [
        'renewal_scan',
        {
          agentName: 'renewal',
          useCase: AI_USE_CASE.RENEWAL_SCAN,
          handler: (ctx, auditCtx) =>
            this.renewal.scanRenewalWindows({
              actorId: auditCtx.actorId ?? ctx.actorId,
              correlationId: auditCtx.correlationId ?? ctx.correlationId ?? undefined,
            }),
        },
      ],
      [
        'upsell_suggest',
        {
          agentName: 'upsell',
          useCase: AI_USE_CASE.UPSELL_SUGGEST,
          handler: (ctx, auditCtx) =>
            this.upsell.suggestUpsell({
              client_id: auditCtx.clientId ?? ctx.clientId ?? undefined,
              actorId: auditCtx.actorId ?? ctx.actorId,
              correlationId: auditCtx.correlationId ?? ctx.correlationId ?? undefined,
            }),
        },
      ],
      [
        'channel_anomaly',
        {
          agentName: 'channel-anomaly',
          useCase: AI_USE_CASE.CHANNEL_ANOMALY_DIGEST,
          handler: (ctx, auditCtx) =>
            this.anomaly.getDigest({
              client_id: auditCtx.clientId ?? ctx.clientId ?? undefined,
              channel: ctx.channel,
              days: ctx.days,
              actorId: auditCtx.actorId ?? ctx.actorId,
              correlationId: auditCtx.correlationId ?? ctx.correlationId ?? undefined,
            }),
        },
      ],
      [
        'budget_recommend',
        {
          agentName: 'budget-recommend',
          useCase: AI_USE_CASE.BUDGET_RECOMMEND,
          handler: async (ctx, auditCtx) => {
            const data = await this.budgetRecommend.listRecommendations({
              staffAuthVia: 'internal',
              client_id: auditCtx.clientId ?? ctx.clientId ?? undefined,
              days: ctx.days != null ? String(ctx.days) : undefined,
            });
            return {
              data,
              meta: { request_id: auditCtx.correlationId ?? ctx.correlationId ?? 'budget' },
              errors: [],
            };
          },
        },
      ],
    ]);
  }

  get(stepKey: string): RegisteredAgent {
    const agent = this.agents.get(stepKey as OrchestratorStepKey);
    if (!agent) {
      throw new BadRequestException({
        error: 'unknown_orchestrator_step',
        error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
        message: `Unknown orchestrator step: ${stepKey}`,
      });
    }
    return agent;
  }

  private requireLeadId(ctx: OrchestratorContext): number {
    const leadId = Number(ctx.leadId ?? ctx.entityId);
    if (!Number.isInteger(leadId) || leadId <= 0) {
      throw new BadRequestException({
        error: 'lead_id_required',
        error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
        message: 'A positive leadId is required for this orchestrator step',
      });
    }
    return leadId;
  }
}
