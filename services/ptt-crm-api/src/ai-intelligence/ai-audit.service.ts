import { createHash, randomUUID } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AI_AUDIT_DEFAULT_AGENT,
  AI_AUDIT_ERROR,
  AiAuditErrorCode,
} from './ai-audit.constants';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import {
  AiAuditContext,
  AiAuditWrapResult,
  AiTokenUsage,
} from './ai-intelligence.types';

const PII_FIELD_KEYS = new Set([
  'text',
  'prompt',
  'body',
  'content',
  'email',
  'phone',
  'name',
  'note',
  'transcript',
  'message',
  'summary',
]);

export interface AiAuditFnResult<T> {
  data: T;
  output?: Record<string, unknown>;
  tokenUsage?: AiTokenUsage;
  modelName?: string;
}

@Injectable()
export class AiAuditService {
  constructor(
    private readonly runs: AiAgentRunsRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  newRequestId(): string {
    return randomUUID();
  }

  hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  shouldStoreRawPayload(): boolean {
    return this.aiConfig.logPii || this.aiConfig.logPrompts;
  }

  redactPayload(input: Record<string, unknown>): Record<string, unknown> {
    if (this.shouldStoreRawPayload()) {
      return input;
    }
    const keys = Object.keys(input);
    const sensitive = keys.filter((k) => PII_FIELD_KEYS.has(k.toLowerCase()));
    if (sensitive.length === 0 && keys.length > 0) {
      return { redacted: true, keys };
    }
    if (keys.length === 0) {
      return {};
    }
    const out: Record<string, unknown> = { redacted: true, keys };
    for (const key of keys) {
      if (!PII_FIELD_KEYS.has(key.toLowerCase())) {
        out[key] = input[key];
      }
    }
    return out;
  }

  /** @deprecated use redactPayload */
  redactInput(input: Record<string, unknown>): Record<string, unknown> {
    return this.redactPayload(input);
  }

  buildStoredInput(ctx: AiAuditContext): Record<string, unknown> {
    const base = { ...(ctx.input ?? {}) };
    if (ctx.entityType) base.entity_type = ctx.entityType;
    if (ctx.entityId) base.entity_id = ctx.entityId;
    return this.redactPayload(base);
  }

  async assertAuditReady(): Promise<void> {
    if (!(await this.runs.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_audit_not_ready',
        error_code: AI_AUDIT_ERROR.SCHEMA_NOT_READY,
      });
    }
  }

  /**
   * RNOS-05 — mọi LLM/score call phải đi qua wrap (BR-AI-03).
   * Inserts terminal row (succeeded | failed) với prompt_hash + latency.
   */
  async wrap<T>(
    ctx: AiAuditContext,
    fn: (meta: { runId: string; requestId: string }) => Promise<AiAuditFnResult<T>>,
    options?: { requireSchema?: boolean },
  ): Promise<AiAuditWrapResult<T>> {
    const requireSchema = options?.requireSchema !== false;
    if (requireSchema) {
      await this.assertAuditReady();
    }

    const requestId = ctx.correlationId?.trim() || this.newRequestId();
    const started = Date.now();
    const inputForHash = {
      ...(ctx.input ?? {}),
      ...(ctx.entityType ? { entity_type: ctx.entityType } : {}),
      ...(ctx.entityId ? { entity_id: ctx.entityId } : {}),
    };

    try {
      const fnResult = await fn({ runId: '', requestId });
      const latencyMs = Date.now() - started;
      const runId = await this.persistTerminal({
        ctx: { ...ctx, correlationId: requestId },
        inputForHash,
        output: fnResult.output ?? { ok: true },
        status: 'succeeded',
        latencyMs,
        tokenUsage: fnResult.tokenUsage,
        modelName: fnResult.modelName,
      });
      return { data: fnResult.data, runId, requestId, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - started;
      const { code, message } = this.normalizeError(err);
      await this.persistTerminal({
        ctx: { ...ctx, correlationId: requestId },
        inputForHash,
        output: { error: message },
        status: 'failed',
        latencyMs,
        errorCode: code,
        errorMessage: message,
      });
      throw err;
    }
  }

  async recordSuccess(
    ctx: AiAuditContext,
    output: Record<string, unknown>,
    latencyMs: number,
    extras?: { tokenUsage?: AiTokenUsage; modelName?: string },
  ): Promise<string> {
    const inputForHash = {
      ...(ctx.input ?? {}),
      ...(ctx.entityType ? { entity_type: ctx.entityType } : {}),
      ...(ctx.entityId ? { entity_id: ctx.entityId } : {}),
    };
    return this.persistTerminal({
      ctx,
      inputForHash,
      output,
      status: 'succeeded',
      latencyMs,
      tokenUsage: extras?.tokenUsage,
      modelName: extras?.modelName,
    });
  }

  async recordFailure(
    ctx: AiAuditContext,
    errorMessage: string,
    latencyMs: number,
    errorCode: AiAuditErrorCode = AI_AUDIT_ERROR.INTERNAL_ERROR,
  ): Promise<string | null> {
    try {
      const inputForHash = {
        ...(ctx.input ?? {}),
        ...(ctx.entityType ? { entity_type: ctx.entityType } : {}),
        ...(ctx.entityId ? { entity_id: ctx.entityId } : {}),
      };
      return await this.persistTerminal({
        ctx,
        inputForHash,
        output: { error: errorMessage },
        status: 'failed',
        latencyMs,
        errorCode,
        errorMessage,
      });
    } catch {
      return null;
    }
  }

  private async persistTerminal(args: {
    ctx: AiAuditContext;
    inputForHash: Record<string, unknown>;
    output: Record<string, unknown>;
    status: 'succeeded' | 'failed';
    latencyMs: number;
    tokenUsage?: AiTokenUsage;
    modelName?: string;
    errorCode?: AiAuditErrorCode;
    errorMessage?: string;
  }): Promise<string> {
    const row = await this.runs.insertRun({
      agentName: args.ctx.agentName ?? AI_AUDIT_DEFAULT_AGENT,
      useCase: args.ctx.useCase,
      clientId: args.ctx.clientId ?? null,
      modelName: args.modelName ?? args.ctx.modelName ?? this.aiConfig.llmModel,
      promptHash: this.hashPayload(args.inputForHash),
      inputJson: this.buildStoredInput(args.ctx),
      outputJson: this.redactPayload(args.output),
      status: args.status,
      latencyMs: args.latencyMs,
      tokenUsage: args.tokenUsage,
      correlationId: args.ctx.correlationId ?? null,
      actorId: args.ctx.actorId ?? null,
      errorMessage: args.errorMessage ?? null,
      errorCode: args.errorCode ?? null,
      parentRunId: args.ctx.parentRunId ?? null,
      orchestrationId: args.ctx.orchestrationId ?? null,
      stepKey: args.ctx.stepKey ?? null,
      stepIndex: args.ctx.stepIndex ?? null,
    });
    return row.id;
  }

  private normalizeError(err: unknown): { code: AiAuditErrorCode; message: string } {
    if (err instanceof ServiceUnavailableException) {
      const body = err.getResponse();
      if (typeof body === 'object' && body && 'error_code' in body) {
        return {
          code: String((body as { error_code: string }).error_code) as AiAuditErrorCode,
          message: String((body as { message?: string }).message ?? err.message),
        };
      }
    }
    if (err instanceof Error) {
      if (err.name === 'TimeoutError' || /timeout/i.test(err.message)) {
        return { code: AI_AUDIT_ERROR.LLM_TIMEOUT, message: err.message };
      }
      return { code: AI_AUDIT_ERROR.INTERNAL_ERROR, message: err.message };
    }
    return { code: AI_AUDIT_ERROR.INTERNAL_ERROR, message: String(err) };
  }
}
