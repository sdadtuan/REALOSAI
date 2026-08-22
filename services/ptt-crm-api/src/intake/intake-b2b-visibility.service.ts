import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { B2bLeadScopeService } from '../b2b-projects/b2b-lead-scope.service';
import { LeadsRepository } from '../leads/leads.repository';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export interface IntakeStaffActor {
  staffId: number;
  caps: StaffSectionCap[];
  positionCode?: string | null;
}

@Injectable()
export class IntakeB2bVisibilityService {
  constructor(
    private readonly config: AppConfigService,
    private readonly leads: LeadsRepository,
    private readonly b2bScope: B2bLeadScopeService,
  ) {}

  async assertLeadVisible(leadId: number, actor: IntakeStaffActor | null | undefined): Promise<void> {
    if (!this.config.b2bProjectOs || !actor) return;
    const lead = await this.leads.getLeadById(leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'not_found' });
    }
    await this.b2bScope.assertLeadVisible({
      staffId: actor.staffId,
      caps: actor.caps,
      positionCode: actor.positionCode,
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
