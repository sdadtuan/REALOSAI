import { BadRequestException, NotFoundException } from '@nestjs/common';
import { B2bLeadAiFilterService } from '../../../b2b-projects/b2b-lead-ai-filter.service';
import { LeadsRepository } from '../../../leads/leads.repository';
import { LeadV1, ListLeadsQuery } from '../../../leads/leads.types';
import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';

function optionalString(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function safeLead(lead: LeadV1): Omit<LeadV1, 'full_name' | 'phone' | 'email' | 'external_lead_id'> {
  const { full_name: _name, phone: _phone, email: _email, external_lead_id: _externalId, ...safe } =
    lead;
  return safe;
}

function scopedClientId(
  input: Record<string, unknown>,
  context: AiToolExecutionContext,
): string | undefined {
  return context.clientId ?? optionalString(input.client_id);
}

export function createLeadQueryTools(
  leads: LeadsRepository,
  b2bAi: B2bLeadAiFilterService,
): AiToolDefinition[] {
  return [
    {
      name: 'list_leads',
      description: 'List CRM leads with tenant-safe filters and PII removed.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string' },
          source: { type: 'string' },
          channel: { type: 'string' },
          client_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_leads.view'],
      handler: async (input, context) => {
        const limit = boundedInteger(input.limit, 50, 1, 200);
        const offset = boundedInteger(input.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        const query: ListLeadsQuery = {
          client_id: scopedClientId(input, context),
          status: optionalString(input.status),
          source: optionalString(input.source),
          channel: optionalString(input.channel),
          limit,
          offset,
          b2b_list_scope: b2bAi.resolveListScope(context.actorId),
        };
        const result = await leads.listLeads(query);
        return {
          leads: result.leads.map(safeLead),
          total: result.total,
          limit,
          offset,
        };
      },
    },
    {
      name: 'get_lead',
      description: 'Get one CRM lead by ID with PII removed.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['lead_id'],
        properties: {
          lead_id: { type: 'integer', minimum: 1 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_leads.view'],
      handler: async (input, context) => {
        const leadId = Number(input.lead_id);
        if (!Number.isInteger(leadId) || leadId <= 0) {
          throw new BadRequestException({
            error: 'lead_id_required',
            message: 'lead_id must be a positive integer',
          });
        }
        const lead = await leads.getLeadById(leadId);
        if (!lead || (context.clientId && lead.client_id !== context.clientId)) {
          throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
        }
        await b2bAi.assertLeadVisible(lead, context.actorId);
        return safeLead(lead);
      },
    },
  ];
}
