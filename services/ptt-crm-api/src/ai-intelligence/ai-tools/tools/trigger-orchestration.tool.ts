import { BadRequestException } from '@nestjs/common';
import { OrchestratorService } from '../../orchestrator/orchestrator.service';
import {
  AiOrchestrationStatus,
  OrchestratorContext,
} from '../../orchestrator/orchestrator.types';
import { AiToolDefinition } from '../ai-tools.types';

function optionalString(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function optionalInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function createOrchestrationTools(
  orchestrator: OrchestratorService,
): AiToolDefinition[] {
  return [
    {
      name: 'run_orchestration',
      description: 'Run a registered multi-agent orchestration plan.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['plan_key', 'input'],
        properties: {
          plan_key: { type: 'string', minLength: 1 },
          input: {
            type: 'object',
            required: ['entityType', 'entityId'],
            properties: {
              entityType: { type: 'string', minLength: 1 },
              entityId: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['ai_orchestrator.run'],
      handler: async (input, context) => {
        const planKey = optionalString(input.plan_key);
        const orchestrationInput = input.input;
        if (
          !planKey ||
          !orchestrationInput ||
          typeof orchestrationInput !== 'object' ||
          Array.isArray(orchestrationInput)
        ) {
          throw new BadRequestException({
            error: 'orchestration_input_required',
            message: 'plan_key and input object are required',
          });
        }
        const response = await orchestrator.run({
          planKey,
          clientId: context.clientId,
          input: orchestrationInput as OrchestratorContext,
          actorId: context.actorId,
          correlationId: context.correlationId,
          triggerType: 'webhook',
          triggerRef: `ai-tool-key:${context.apiKeyId}`,
        });
        return response.data;
      },
    },
    {
      name: 'list_orchestrations',
      description: 'List recent orchestration runs and statuses.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          plan_key: { type: 'string' },
          status: {
            type: 'string',
            enum: ['running', 'succeeded', 'failed', 'cancelled'],
          },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['ai_admin.view'],
      handler: async (input, context) => {
        const response = await orchestrator.list(
          {
            from: optionalString(input.from),
            to: optionalString(input.to),
            planKey: optionalString(input.plan_key),
            status: optionalString(input.status) as AiOrchestrationStatus | undefined,
            limit: optionalInteger(input.limit),
            offset: optionalInteger(input.offset),
          },
          context.correlationId,
        );
        return response.data;
      },
    },
    {
      name: 'health_check',
      description: 'Check whether the AI tool proxy is available.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      outputSchema: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', const: 'ok' } },
      },
      mutating: false,
      requiredCaps: [],
      handler: async () => ({
        status: 'ok',
        service: 'ai-tool-proxy',
        checked_at: new Date().toISOString(),
      }),
    },
  ];
}
