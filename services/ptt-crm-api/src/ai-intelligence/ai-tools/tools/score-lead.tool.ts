import { BadRequestException } from '@nestjs/common';
import { AgentRegistry } from '../../orchestrator/agent.registry';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';

function requireLeadId(input: Record<string, unknown>): number {
  const leadId = Number(input.lead_id ?? input.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    throw new BadRequestException({
      error: 'lead_id_required',
      message: 'lead_id must be a positive integer',
    });
  }
  return leadId;
}

async function callLeadAgent(
  agents: AgentRegistry,
  stepKey: 'score_lead' | 'route_rep',
  input: Record<string, unknown>,
  context: AiToolExecutionContext,
): Promise<unknown> {
  const leadId = requireLeadId(input);
  const result = await agents.get(stepKey).handler(
    {
      entityType: 'lead',
      entityId: String(leadId),
      leadId,
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
  return result.data;
}

export function createLeadAgentTools(agents: AgentRegistry): AiToolDefinition[] {
  const leadIdSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['lead_id'],
    properties: {
      lead_id: { type: 'integer', minimum: 1 },
    },
  };

  return [
    {
      name: 'score_lead',
      description: 'Calculate and persist the current AI score for a lead.',
      inputSchema: leadIdSchema,
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.view'],
      handler: (input, context) => callLeadAgent(agents, 'score_lead', input, context),
    },
    {
      name: 'route_lead',
      description: 'Create an AI routing recommendation for a lead.',
      inputSchema: leadIdSchema,
      outputSchema: { type: 'object' },
      mutating: true,
      requiredCaps: ['crm_leads.assign'],
      handler: (input, context) => callLeadAgent(agents, 'route_rep', input, context),
    },
  ];
}
