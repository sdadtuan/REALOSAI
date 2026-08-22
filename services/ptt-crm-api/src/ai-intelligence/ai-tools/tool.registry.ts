import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadsRepository } from '../../leads/leads.repository';
import { B2bLeadAiFilterService } from '../../b2b-projects/b2b-lead-ai-filter.service';
import { AI_USE_CASE } from '../ai-audit.constants';
import { AiAuditService } from '../ai-audit.service';
import { AiForecastService } from '../ai-forecast.service';
import { AgentRegistry } from '../orchestrator/agent.registry';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import {
  AiToolCallContext,
  AiToolDefinition,
  AiToolDescriptor,
  AiToolExecutionContext,
} from './ai-tools.types';
import { createAgentInsightTools } from './tools/agent-tools.tool';
import { createForecastTools } from './tools/get-forecast.tool';
import { createLeadQueryTools } from './tools/list-leads.tool';
import { createLeadAgentTools } from './tools/score-lead.tool';
import { createOrchestrationTools } from './tools/trigger-orchestration.tool';

@Injectable()
export class ToolRegistry {
  private readonly definitions: readonly AiToolDefinition[];
  private readonly toolsByName: ReadonlyMap<string, AiToolDefinition>;

  constructor(
    private readonly audit: AiAuditService,
    agents: AgentRegistry,
    leads: LeadsRepository,
    b2bAi: B2bLeadAiFilterService,
    forecast: AiForecastService,
    orchestrator: OrchestratorService,
  ) {
    this.definitions = [
      ...createLeadAgentTools(agents),
      ...createLeadQueryTools(leads, b2bAi),
      ...createForecastTools(forecast),
      ...createAgentInsightTools(agents),
      ...createOrchestrationTools(orchestrator),
    ];
    this.toolsByName = new Map(this.definitions.map((tool) => [tool.name, tool]));
  }

  list(): AiToolDescriptor[] {
    return this.definitions.map(({ handler: _handler, ...descriptor }) => descriptor);
  }

  async call(
    name: string,
    input: Record<string, unknown>,
    context: AiToolCallContext,
  ): Promise<unknown> {
    const result = await this.callWithMetadata(name, input, context);
    return result.data;
  }

  async callWithMetadata(
    name: string,
    input: Record<string, unknown>,
    context: AiToolCallContext,
  ): Promise<{ data: unknown; runId: string }> {
    const toolName = String(name ?? '').trim();
    const tool = this.toolsByName.get(toolName);
    if (!tool) {
      throw new NotFoundException({
        error: 'tool_not_found',
        tool_name: toolName,
      });
    }

    const actorId = context.actorId ?? `ai-tool-key:${context.apiKey.id}`;
    const wrapped = await this.audit.wrap(
      {
        agentName: 'ai-tool-proxy',
        useCase: AI_USE_CASE.TOOL_CALL,
        entityType: 'ai_tool',
        entityId: toolName,
        clientId: context.apiKey.client_id,
        actorId,
        correlationId: context.correlationId,
        modelName: 'ai-tool-proxy-v1',
        input: { tool_name: toolName },
      },
      async ({ requestId }) => {
        this.assertAllowed(toolName, context);
        const executionContext: AiToolExecutionContext = {
          apiKeyId: context.apiKey.id,
          clientId: context.apiKey.client_id,
          actorId,
          correlationId: requestId,
        };
        const data = await tool.handler(input ?? {}, executionContext);
        return {
          data,
          output: { tool_name: toolName, status: 'succeeded' },
          modelName: 'ai-tool-proxy-v1',
          tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    );

    return { data: wrapped.data, runId: wrapped.runId };
  }

  private assertAllowed(name: string, context: AiToolCallContext): void {
    if (!context.apiKey.allowed_tools.includes(name)) {
      throw new ForbiddenException({
        error: 'tool_not_allowed',
        tool_name: name,
        api_key_id: context.apiKey.id,
      });
    }
  }
}
