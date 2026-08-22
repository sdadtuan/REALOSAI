import { BadRequestException, Injectable } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-audit.constants';
import { AiAuditService } from '../ai-audit.service';
import { AgentRegistry } from './agent.registry';
import { LEAD_INTAKE_PLAN } from './plans/lead-intake.plan';
import { RETAIN_HEALTH_CLIENT_PLAN } from './plans/retain-health-client.plan';
import { RETAIN_HEALTH_PLAN } from './plans/retain-health.plan';
import { CPL_WEEKLY_PLAN } from './plans/cpl-weekly.plan';
import {
  OrchestrationPlan,
  OrchestratorContext,
  OrchestratorEngineContext,
  OrchestratorStepExecution,
  StepResult,
} from './orchestrator.types';

const STATIC_PLANS: ReadonlyMap<string, OrchestrationPlan> = new Map<
  string,
  OrchestrationPlan
>([
  [LEAD_INTAKE_PLAN.key, LEAD_INTAKE_PLAN],
  [RETAIN_HEALTH_PLAN.key, RETAIN_HEALTH_PLAN],
  [RETAIN_HEALTH_CLIENT_PLAN.key, RETAIN_HEALTH_CLIENT_PLAN],
  [CPL_WEEKLY_PLAN.key, CPL_WEEKLY_PLAN],
]);

export class OrchestratorRequiredStepError extends Error {
  constructor(
    message: string,
    readonly failedStep: string,
    readonly steps: OrchestratorStepExecution[],
  ) {
    super(message);
    this.name = 'OrchestratorRequiredStepError';
  }
}

@Injectable()
export class OrchestratorEngine {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly audit: AiAuditService,
  ) {}

  async runPlan(
    planKey: string,
    execution: OrchestratorEngineContext,
  ): Promise<OrchestratorStepExecution[]> {
    const plan = this.resolvePlan(planKey);

    const context: OrchestratorContext = {
      ...execution.input,
      clientId: execution.clientId ?? execution.input.clientId,
      actorId: execution.actorId ?? execution.input.actorId,
      correlationId: execution.correlationId ?? execution.input.correlationId,
    };
    const results: OrchestratorStepExecution[] = [];

    for (const [stepIndex, step] of plan.steps.entries()) {
      if (step.when && !step.when(context)) {
        results.push({
          stepKey: step.key,
          stepIndex,
          required: step.required,
          status: 'skipped',
        });
        continue;
      }

      const agent = this.registry.get(step.key);
      try {
        const wrapped = await this.audit.wrap<StepResult>(
          {
            useCase: AI_USE_CASE.ORCHESTRATION_STEP,
            agentName: agent.agentName,
            entityType: context.entityType,
            entityId: context.entityId,
            clientId: execution.clientId ?? null,
            actorId: execution.actorId ?? null,
            correlationId: execution.correlationId ?? null,
            parentRunId: execution.parentRunId,
            orchestrationId: execution.orchestrationId,
            stepKey: step.key,
            stepIndex,
            input: {
              plan_key: execution.planKey,
              step_key: step.key,
              step_index: stepIndex,
              required: step.required,
              delegated_use_case: agent.useCase,
            },
          },
          async () => {
            const delegated = await agent.handler(context, {
              actorId: execution.actorId,
              correlationId: execution.correlationId,
              clientId: execution.clientId,
            });
            return {
              data: delegated,
              output: {
                step_key: step.key,
                delegated_use_case: agent.useCase,
                result: delegated.data,
              },
            };
          },
        );

        this.mergeStepData(context, wrapped.data.data);
        results.push({
          stepKey: step.key,
          stepIndex,
          required: step.required,
          status: 'succeeded',
          runId: wrapped.runId,
          data: wrapped.data.data,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          stepKey: step.key,
          stepIndex,
          required: step.required,
          status: 'failed',
          error: message,
        });
        if (step.required) {
          throw new OrchestratorRequiredStepError(message, step.key, results);
        }
      }
    }

    return results;
  }

  resolvePlan(planKey: string): OrchestrationPlan {
    const plan = STATIC_PLANS.get(planKey);
    if (!plan) {
      throw new BadRequestException({
        error: 'unknown_orchestration_plan',
        error_code: AI_AUDIT_ERROR.VALIDATION_ERROR,
        plan_key: planKey,
      });
    }
    return plan;
  }

  private mergeStepData(context: OrchestratorContext, data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const record = data as Record<string, unknown>;
    const score = Number(record.score);
    if (Number.isFinite(score)) {
      context.leadScore = score;
    }
  }
}
