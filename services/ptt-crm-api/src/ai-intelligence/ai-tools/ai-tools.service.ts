import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';
import { AiToolKeysRepository } from './ai-tool-keys.repository';
import {
  AiToolApiKeyCreateResult,
  AiToolApiKeyRecord,
  AiToolApiKeyScope,
  AiToolDescriptor,
} from './ai-tools.types';
import { ToolRegistry } from './tool.registry';

export interface AiToolCallParams {
  toolName: string;
  input?: Record<string, unknown>;
  apiKey?: AiToolApiKeyScope;
  actorId?: string | null;
  correlationId?: string | null;
}

export interface CreateAiToolKeyParams {
  name: string;
  allowedTools: string[];
  clientId?: string | null;
  createdBy?: string | null;
}

@Injectable()
export class AiToolsService {
  constructor(
    private readonly config: AiIntelligenceConfigService,
    private readonly registry: ToolRegistry,
    private readonly keys: AiToolKeysRepository,
  ) {}

  list(): AiToolDescriptor[] {
    this.assertEnabled();
    return this.registry.list();
  }

  async call(params: AiToolCallParams): Promise<unknown> {
    this.assertEnabled();
    const toolName = String(params.toolName ?? '').trim();
    const input = params.input ?? {};
    const apiKey = params.apiKey ?? this.staffScope();
    const startedAt = Date.now();

    try {
      const callResult = await this.registry.callWithMetadata(toolName, input, {
        apiKey,
        actorId: params.actorId,
        correlationId: params.correlationId,
      });
      await this.keys.recordCall({
        apiKeyId: params.apiKey?.id ?? null,
        toolName,
        inputJson: input,
        outputJson: this.asJsonObject(callResult.data),
        status: 'succeeded',
        latencyMs: Date.now() - startedAt,
        agentRunId: callResult.runId,
      });
      return callResult.data;
    } catch (error) {
      await this.keys.recordCall({
        apiKeyId: params.apiKey?.id ?? null,
        toolName,
        inputJson: input,
        outputJson: {
          error: error instanceof Error ? error.message : 'tool_call_failed',
        },
        status: 'failed',
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  createKey(params: CreateAiToolKeyParams): Promise<AiToolApiKeyCreateResult> {
    const name = String(params.name ?? '').trim();
    const allowedTools = [...new Set(params.allowedTools ?? [])];
    const knownTools = new Set(this.registry.list().map((tool) => tool.name));
    if (!name) {
      throw new BadRequestException({ error: 'key_name_required' });
    }
    if (allowedTools.length === 0 || allowedTools.some((tool) => !knownTools.has(tool))) {
      throw new BadRequestException({ error: 'invalid_allowed_tools' });
    }
    return this.keys.create(
      name,
      allowedTools,
      params.clientId ?? null,
      params.createdBy ?? null,
    );
  }

  listKeys(): Promise<AiToolApiKeyRecord[]> {
    return this.keys.listKeys();
  }

  async revokeKey(id: string): Promise<void> {
    await this.keys.revoke(id);
  }

  private staffScope(): AiToolApiKeyScope {
    return {
      id: 'staff',
      client_id: null,
      allowed_tools: this.registry.list().map((tool) => tool.name),
    };
  }

  private assertEnabled(): void {
    if (!this.config.toolsApiEnabled) {
      throw new ServiceUnavailableException({ error: 'ai_tools_api_disabled' });
    }
  }

  private asJsonObject(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { result: value };
  }
}
