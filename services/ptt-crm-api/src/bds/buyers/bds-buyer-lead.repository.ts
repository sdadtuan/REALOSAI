import { Injectable } from '@nestjs/common';
import { BdsBuyerLeadPgRepository } from './bds-buyer-lead-pg.repository';
import type { BuyerLeadRow, CreateBuyerLeadBody } from './bds-buyer.types';

@Injectable()
export class BdsBuyerLeadRepository {
  constructor(private readonly pg: BdsBuyerLeadPgRepository) {}

  findReBuyerByPhoneProject(input: {
    phone: string;
    reProjectId: number;
    tenantId: string;
  }): Promise<{ lead_id: number } | null> {
    return this.pg.findReBuyerByPhoneProject(input);
  }

  patchLeadMeta(leadId: number, patch: Record<string, unknown>): Promise<void> {
    return this.pg.patchLeadMeta(leadId, patch);
  }

  setLeadStatus(leadId: number, status: string): Promise<void> {
    return this.pg.setLeadStatus(leadId, status);
  }

  getLeadForScope(leadId: number): Promise<BuyerLeadRow | null> {
    return this.pg.getLeadForScope(leadId);
  }

  listByProject(projectId: number, tenantId?: string): Promise<BuyerLeadRow[]> {
    return this.pg.listByProject(projectId, tenantId);
  }

  createLead(body: CreateBuyerLeadBody, tenantId: string): Promise<BuyerLeadRow> {
    return this.pg.createLead(body, tenantId);
  }

  isProjectStaff(projectId: number, staffId: number): Promise<boolean> {
    return this.pg.isProjectStaff(projectId, staffId);
  }
}
