import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LeadV1, ListLeadsQuery } from '../leads/leads.types';
import { B2bLeadScopeService } from './b2b-lead-scope.service';

function parseStaffIdFromActor(actorId: string | null | undefined): number | null {
  const raw = String(actorId ?? '').trim();
  if (!raw || raw.startsWith('ai-tool-key:')) return null;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}

@Injectable()
export class B2bLeadAiFilterService {
  constructor(
    private readonly config: AppConfigService,
    private readonly b2bScope: B2bLeadScopeService,
  ) {}

  /** SQL list scope for AI tools; API keys without staff deny all B2B rows. */
  resolveListScope(actorId: string | null | undefined): ListLeadsQuery['b2b_list_scope'] | undefined {
    if (!this.config.b2bProjectOs) return undefined;
    const staffId = parseStaffIdFromActor(actorId);
    if (staffId == null) {
      return { staffId: -1, viewAll: false, isDirector: false };
    }
    return { staffId, viewAll: false, isDirector: false };
  }

  async assertLeadVisible(lead: LeadV1, actorId: string | null | undefined): Promise<void> {
    if (!this.config.b2bProjectOs) return;
    const staffId = parseStaffIdFromActor(actorId);
    if (staffId == null) {
      if (lead.lead_flow_kind === 'b2b_prospect') {
        throw new NotFoundException({ error: 'lead_not_found', lead_id: lead.id });
      }
      return;
    }
    await this.b2bScope.assertLeadVisible({
      staffId,
      caps: [],
      lead: {
        owner_id: lead.owner_id,
        client_id: lead.client_id,
        channel: lead.channel,
        source: lead.source,
        status: lead.status,
        b2b_project_id: lead.b2b_project_id,
        meta_json: { lead_flow_kind: lead.lead_flow_kind },
      },
    });
  }
}
