import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-agent-runs.repository';
import { AI_USE_CASE } from '../ai-audit.constants';
import { AiAuditService } from '../ai-audit.service';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';
import { AiApiEnvelope } from '../ai-intelligence.types';
import {
  OrchestratorEngine,
  OrchestratorRequiredStepError,
} from './orchestrator.engine';
import { OrchestratorRepository } from './orchestrator.repository';
import {
  AiOrchestrationTree,
  OrchestratorListQuery,
  OrchestratorListResult,
  OrchestratorRunData,
  OrchestratorRunRequest,
} from './orchestrator.types';

export type OrchestratorRunResponse = AiApiEnvelope<OrchestratorRunData>;
export type OrchestratorDetailResponse = AiApiEnvelope<AiOrchestrationTree>;
export type OrchestratorListResponse = AiApiEnvelope<
  OrchestratorListResult & { limit: number; offset: number }
>;

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly config: AiIntelligenceConfigService,
    private readonly repository: OrchestratorRepository,
    private readonly runs: AiAgentRunsRepository,
    private readonly engine: OrchestratorEngine,
    private readonly audit: AiAuditService,
  ) {}

  isEnabled(): boolean {
    return this.config.orchestratorEnabled;
  }

  async run(request: OrchestratorRunRequest): Promise<OrchestratorRunResponse> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException({
        error: 'orchestrator_disabled',
        message: 'PTT_AI_ORCHESTRATOR_ENABLED is off',
      });
    }

    const planKey = String(request.planKey ?? '').trim();
    this.engine.resolvePlan(planKey);
    const entityType = String(request.input?.entityType ?? '').trim();
    const entityId = String(request.input?.entityId ?? '').trim();
    if (!entityType || !entityId) {
      throw new BadRequestException({
        error: 'orchestrator_entity_required',
        message: 'input.entityType and input.entityId are required',
      });
    }
    await this.assertReady();

    const requestId = request.correlationId?.trim() || this.audit.newRequestId();
    const actorId = request.actorId ?? null;
    const clientId = request.clientId?.trim() || null;
    const input = {
      ...request.input,
      entityType,
      entityId,
      clientId,
      actorId,
      correlationId: requestId,
    };
    const storedInput = this.audit.redactPayload(input);
    const started = Date.now();
    const orchestration = await this.repository.create({
      clientId,
      triggerType: request.triggerType ?? 'manual',
      triggerRef: request.triggerRef ?? null,
      planKey,
      status: 'running',
      inputJson: storedInput,
      correlationId: requestId,
      actorId,
    });
    let parentRun;
    try {
      parentRun = await this.runs.insertRun({
        agentName: 'orchestrator',
        useCase: AI_USE_CASE.ORCHESTRATION_RUN,
        clientId,
        status: 'running',
        orchestrationId: orchestration.id,
        inputJson: this.audit.redactPayload({
          plan_key: planKey,
          entity_type: entityType,
          entity_id: entityId,
        }),
        correlationId: requestId,
        actorId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const output = this.audit.redactPayload({
        failed_step: 'orchestrator',
        error: message,
        steps: [],
      });
      await Promise.allSettled([
        this.repository.updateStatus(orchestration.id, 'failed', output),
      ]);
      throw error;
    }

    try {
      const steps = await this.engine.runPlan(planKey, {
        orchestrationId: orchestration.id,
        parentRunId: parentRun.id,
        planKey,
        input,
        actorId,
        correlationId: requestId,
        clientId,
      });
      const output = this.audit.redactPayload({
        completed_steps: steps.filter((step) => step.status === 'succeeded').length,
        failed_optional_steps: steps.filter((step) => step.status === 'failed').length,
        skipped_steps: steps.filter((step) => step.status === 'skipped').length,
        steps: this.redactStepResults(steps),
      });
      await this.runs.updateRun(parentRun.id, {
        status: 'succeeded',
        outputJson: output,
        latencyMs: Date.now() - started,
      });
      await this.repository.updateStatus(orchestration.id, 'succeeded', output);

      return {
        data: {
          orchestration_id: orchestration.id,
          parent_run_id: parentRun.id,
          plan_key: planKey,
          status: 'succeeded',
          steps,
        },
        meta: { request_id: requestId },
        errors: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedStep =
        error instanceof OrchestratorRequiredStepError ? error.failedStep : 'orchestrator';
      const output = this.audit.redactPayload({
        failed_step: failedStep,
        error: message,
        steps:
          error instanceof OrchestratorRequiredStepError
            ? this.redactStepResults(error.steps)
            : [],
      });
      await Promise.allSettled([
        this.runs.updateRun(parentRun.id, {
          status: 'failed',
          outputJson: output,
          errorMessage: message,
          latencyMs: Date.now() - started,
        }),
        this.repository.updateStatus(orchestration.id, 'failed', output),
      ]);
      throw error;
    }
  }

  async get(id: string, correlationId?: string): Promise<OrchestratorDetailResponse> {
    await this.assertReady();
    const orchestration = await this.repository.getOrchestration(id);
    if (!orchestration) {
      throw new NotFoundException({ error: 'orchestration_not_found', id });
    }
    const allRuns = await this.runs.listByOrchestration(id);
    const parentRun =
      allRuns.find((run) => run.parent_run_id === null && run.agent_name === 'orchestrator') ??
      null;
    const children = parentRun
      ? allRuns.filter((run) => run.parent_run_id === parentRun.id)
      : [];

    return {
      data: { orchestration, parentRun, children },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  async list(
    query: OrchestratorListQuery = {},
    correlationId?: string,
  ): Promise<OrchestratorListResponse> {
    await this.assertReady();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const result = await this.repository.list({ ...query, limit, offset });
    return {
      data: { ...result, limit, offset },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  private redactStepResults(
    steps: OrchestratorRunData['steps'],
  ): OrchestratorRunData['steps'] {
    return steps.map((step) => {
      if (!step.data || typeof step.data !== 'object' || Array.isArray(step.data)) {
        return step;
      }
      return {
        ...step,
        data: this.audit.redactPayload(step.data as Record<string, unknown>),
      };
    });
  }

  private async assertReady(): Promise<void> {
    await this.audit.assertAuditReady();
    if (!(await this.repository.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'orchestrator_schema_not_ready',
        message: 'Apply RNOS-31 orchestrator migration',
      });
    }
  }
}
