import { Injectable, NotFoundException } from '@nestjs/common';
import { hasGdkdViewAllLeads } from '../../staff-permissions/staff-gdkd.util';
import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';
import type { BuyerLeadRow } from './bds-buyer.types';
import { BdsBuyerLeadRepository } from './bds-buyer-lead.repository';

export type BuyerLeadScopeInput = {
  lead: BuyerLeadRow;
  staffId?: number;
  agencyId?: string;
  viewAll?: boolean;
  caps?: StaffSectionCap[];
};

@Injectable()
export class BdsBuyerLeadScopeService {
  constructor(private readonly leadRepo: BdsBuyerLeadRepository) {}

  async assertVisible(input: BuyerLeadScopeInput): Promise<void> {
    if (input.viewAll || (input.caps && hasGdkdViewAllLeads(input.caps))) {
      return;
    }

    const agencyId = String(input.agencyId ?? '').trim();
    const channelPartner = String(input.lead.channel_partner_id ?? input.lead.meta_json.channel_partner_id ?? '').trim();

    if (agencyId) {
      if (!channelPartner || channelPartner !== agencyId) {
        throw new NotFoundException({ error: 'not_found' });
      }
      return;
    }

    const staffId = Number(input.staffId ?? 0);
    const projectId = Number(input.lead.re_project_id ?? input.lead.meta_json.re_project_id ?? 0);
    if (staffId > 0 && projectId > 0) {
      const member = await this.leadRepo.isProjectStaff(projectId, staffId);
      if (member) return;
    }

    throw new NotFoundException({ error: 'not_found' });
  }
}
