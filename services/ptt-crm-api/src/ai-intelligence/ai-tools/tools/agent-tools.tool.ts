import { AgentRegistry } from '../../orchestrator/agent.registry';
import { AiToolDefinition } from '../ai-tools.types';

export function createAgentInsightTools(agents: AgentRegistry): AiToolDefinition[] {
  return [
    {
      name: 'suggest_upsell',
      description: 'Generate read-only upsell recommendations for the scoped client.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_service_lifecycle.view'],
      handler: async (_input, context) => {
        const response = await agents.get('upsell_suggest').handler(
          {
            clientId: context.clientId,
            actorId: context.actorId,
            correlationId: context.correlationId,
          },
          {
            clientId: context.clientId,
            actorId: context.actorId,
            correlationId: context.correlationId,
          },
        );
        return response.data;
      },
    },
    {
      name: 'get_anomaly_digest',
      description: 'Get the recent channel anomaly digest for the scoped client.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          channel: { type: 'string', enum: ['all', 'meta', 'zalo'], default: 'all' },
          days: { type: 'integer', minimum: 1, maximum: 30, default: 7 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['ai_admin.view'],
      handler: async (input, context) => {
        const days = Number(input.days);
        const response = await agents.get('channel_anomaly').handler(
          {
            clientId: context.clientId,
            channel: String(input.channel ?? 'all'),
            days: Number.isFinite(days) ? days : 7,
            actorId: context.actorId,
            correlationId: context.correlationId,
          },
          {
            clientId: context.clientId,
            actorId: context.actorId,
            correlationId: context.correlationId,
          },
        );
        return response.data;
      },
    },
  ];
}
