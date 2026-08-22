import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { enforceContactPolicy, validatePrepResultShape } from './lead-meeting-prep-llm.util';

export interface LmpLlmCompleteBody {
  lead_id: number;
  client_id?: string | null;
  system_prompt: string;
  user_prompt: string;
  prompt_version?: string;
  prep_stage?: string;
  stub_fallback?: Record<string, unknown>;
  correlation_id?: string | null;
}

@Injectable()
export class LeadMeetingPrepLlmService {
  private readonly logger = new Logger(LeadMeetingPrepLlmService.name);

  constructor(
    private readonly llm: AiLlmClient,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly agentRuns: AiAgentRunsRepository,
  ) {}

  async completeSynthesize(body: LmpLlmCompleteBody, correlationId?: string | null) {
    const started = Date.now();
    const leadId = Number(body.lead_id);
    const prepStage = body.prep_stage ?? 'm1_first_strike';
    const promptVersion = body.prompt_version ?? 'lmp-synth-v1';
    const stubFallback =
      body.stub_fallback && typeof body.stub_fallback === 'object'
        ? enforceContactPolicy(body.stub_fallback)
        : {};

    const promptHash = createHash('sha256')
      .update(`${body.system_prompt}\n---\n${body.user_prompt}`)
      .digest('hex')
      .slice(0, 16);

    let runId: string | null = null;
    try {
      const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
        systemPrompt: body.system_prompt,
        userContent: body.user_prompt,
        model: this.aiConfig.llmModel,
        stubJson: () => stubFallback,
      });

      const normalized = enforceContactPolicy(parsed);
      validatePrepResultShape(normalized);

      if (await this.agentRuns.tableReady()) {
        const run = await this.agentRuns.insertRun({
          agentName: 'lead-meeting-prep',
          useCase: AI_USE_CASE.LEAD_MEETING_PREP,
          clientId: body.client_id ?? null,
          modelName,
          promptHash,
          inputJson: {
            lead_id: leadId,
            prep_stage: prepStage,
            prompt_version: promptVersion,
          },
          outputJson: { result_keys: Object.keys(normalized) },
          status: 'succeeded',
          latencyMs: Date.now() - started,
          tokenUsage,
          correlationId: correlationId ?? body.correlation_id ?? null,
        });
        runId = run.id;
      }

      const meta =
        normalized.meta && typeof normalized.meta === 'object'
          ? (normalized.meta as Record<string, unknown>)
          : {};
      meta.prompt_version = promptVersion;
      meta.prep_stage = prepStage;
      meta.model = modelName;
      normalized.meta = meta;

      return {
        ok: true,
        result: normalized,
        ai_run_id: runId,
        model_name: modelName,
        stub_mode: stubMode,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LMP LLM failed lead=${leadId}: ${message}`);

      if (await this.agentRuns.tableReady()) {
        try {
          const run = await this.agentRuns.insertRun({
            agentName: 'lead-meeting-prep',
            useCase: AI_USE_CASE.LEAD_MEETING_PREP,
            clientId: body.client_id ?? null,
            modelName: this.aiConfig.llmModel,
            promptHash,
            inputJson: { lead_id: leadId, prep_stage: prepStage },
            outputJson: {},
            status: 'failed',
            latencyMs: Date.now() - started,
            errorMessage: message,
            errorCode: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
            correlationId: correlationId ?? body.correlation_id ?? null,
          });
          runId = run.id;
        } catch (auditErr) {
          this.logger.warn(`LMP audit persist failed: ${String(auditErr)}`);
        }
      }

      const fallback = enforceContactPolicy(stubFallback);
      validatePrepResultShape(fallback);
      return {
        ok: true,
        result: fallback,
        ai_run_id: runId,
        model_name: `${this.aiConfig.llmModel}-fallback`,
        stub_mode: true,
        error: message,
      };
    }
  }
}
