import { Injectable, Logger } from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';
import { UpsellContextRepository } from '../upsell-context.repository';
import { RETAIN_HEALTH_CLIENT_PLAN } from './plans/retain-health-client.plan';
import { RETAIN_HEALTH_PLAN } from './plans/retain-health.plan';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorCronJobOutcome } from './orchestrator.types';

const DEFAULT_CLIENT_LIMIT = 50;

export interface OrchestratorCronRunRequest {
  limit?: number;
  offset?: number;
  actorId?: string | null;
  correlationId?: string | null;
}

@Injectable()
export class OrchestratorCronService {
  private readonly logger = new Logger(OrchestratorCronService.name);

  constructor(
    private readonly config: AiIntelligenceConfigService,
    private readonly orchestrator: OrchestratorService,
    private readonly upsellContext: UpsellContextRepository,
  ) {}

  isCronEnabled(): boolean {
    return this.config.orchestratorCronEnabled && this.config.orchestratorEnabled;
  }

  cronStatus() {
    return {
      ok: true,
      retain_health: {
        enabled: this.isCronEnabled(),
        orchestrator_enabled: this.config.orchestratorEnabled,
        cron_enabled: this.config.orchestratorCronEnabled,
        renewal_plan_key: RETAIN_HEALTH_PLAN.key,
        client_plan_key: RETAIN_HEALTH_CLIENT_PLAN.key,
      },
    };
  }

  async runDailyRetainHealth(
    input: OrchestratorCronRunRequest = {},
  ): Promise<OrchestratorCronJobOutcome> {
    if (!this.config.orchestratorCronEnabled) {
      return { ok: true, skipped: true, reason: 'orchestrator_cron_disabled' };
    }
    if (!this.config.orchestratorEnabled) {
      return { ok: true, skipped: true, reason: 'orchestrator_disabled' };
    }

    const limit = Math.min(Math.max(input.limit ?? DEFAULT_CLIENT_LIMIT, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const requestId =
      input.correlationId?.trim() ||
      `retain_health_cron:${new Date().toISOString().slice(0, 10)}`;
    const actorId = input.actorId ?? 'system';

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    let renewalScan: 'succeeded' | 'failed' = 'succeeded';

    try {
      await this.orchestrator.run({
        planKey: RETAIN_HEALTH_PLAN.key,
        clientId: undefined,
        triggerType: 'cron',
        triggerRef: requestId,
        actorId,
        correlationId: `${requestId}:renewal_scan`,
        input: {
          entityType: 'portfolio',
          entityId: 'active_contracts',
          actorId,
          correlationId: `${requestId}:renewal_scan`,
        },
      });
    } catch (error) {
      renewalScan = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`renewal_scan: ${message}`);
      this.logger.warn(`${RETAIN_HEALTH_PLAN.key} cron failed: ${message}`);
    }

    const clientIds = await this.upsellContext.listActiveClientIds(limit, offset);

    for (const clientId of clientIds) {
      try {
        await this.orchestrator.run({
          planKey: RETAIN_HEALTH_CLIENT_PLAN.key,
          clientId,
          triggerType: 'cron',
          triggerRef: requestId,
          actorId,
          correlationId: `${requestId}:${clientId}`,
          input: {
            entityType: 'agency_client',
            entityId: clientId,
            clientId,
            actorId,
            correlationId: `${requestId}:${clientId}`,
          },
        });
        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${clientId}: ${message}`);
        this.logger.warn(`${RETAIN_HEALTH_CLIENT_PLAN.key} cron failed for ${clientId}: ${message}`);
      }
    }

    return {
      ok: renewalScan === 'succeeded' && failed === 0,
      plan_key: RETAIN_HEALTH_CLIENT_PLAN.key,
      renewal_plan_key: RETAIN_HEALTH_PLAN.key,
      renewal_scan: renewalScan,
      clients: clientIds.length,
      succeeded,
      failed,
      errors: errors.slice(0, 20),
    };
  }
}
