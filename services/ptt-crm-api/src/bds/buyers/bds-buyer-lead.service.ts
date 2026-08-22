import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BdsBuyerRepository } from './bds-buyer.repository';
import { BdsBuyerLeadRepository } from './bds-buyer-lead.repository';
import type {
  BuyerLeadRow,
  CreateBuyerLeadBody,
  QualifyBuyerLeadBody,
} from './bds-buyer.types';
import {
  assertNoB2bProjectOnReBuyer,
  normalizeNeedJson,
  normalizePhoneE164,
  qualifyBuyerEligible,
} from './bds-buyer.util';
import { BdsBuyerLeadScopeService } from './bds-buyer-lead-scope.service';

@Injectable()
export class BdsBuyerLeadService {
  constructor(
    private readonly leadRepo: BdsBuyerLeadRepository,
    private readonly buyerRepo: BdsBuyerRepository,
    private readonly scope: BdsBuyerLeadScopeService,
  ) {}

  async list(
    projectId: number,
    tenantId: string,
    opts: { staffId?: number; agencyId?: string; viewAll?: boolean } = {},
  ): Promise<BuyerLeadRow[]> {
    const rows = await this.leadRepo.listByProject(projectId, tenantId);
    if (opts.viewAll || !opts.staffId) return rows;
    const visible: BuyerLeadRow[] = [];
    for (const row of rows) {
      try {
        await this.scope.assertVisible({
          lead: row,
          staffId: opts.staffId,
          agencyId: opts.agencyId,
          viewAll: opts.viewAll,
        });
        visible.push(row);
      } catch {
        // skip out-of-scope rows on board list
      }
    }
    return visible;
  }

  async create(body: CreateBuyerLeadBody, tenantId: string): Promise<BuyerLeadRow> {
    assertNoB2bProjectOnReBuyer({ leadFlowKind: 're_buyer', b2bProjectId: null });
    if (!body.full_name?.trim() || !body.phone?.trim()) {
      throw new BadRequestException({ error: 'contact' });
    }
    if (!Number.isFinite(body.re_project_id) || body.re_project_id <= 0) {
      throw new BadRequestException({ error: 're_project_id' });
    }
    const dup = await this.leadRepo.findReBuyerByPhoneProject({
      phone: body.phone,
      reProjectId: body.re_project_id,
      tenantId,
    });
    if (dup) {
      throw new BadRequestException({
        error: 'duplicate_phone_project',
        lead_id: dup.lead_id,
      });
    }
    return this.leadRepo.createLead(body, tenantId);
  }

  async qualify(
    leadId: number,
    body: QualifyBuyerLeadBody,
    tenantId: string,
    scopeOpts: { staffId?: number; agencyId?: string; viewAll?: boolean } = {},
  ): Promise<{ lead: BuyerLeadRow; buyer_id: string }> {
    const lead = await this.getLeadOrThrow(leadId, tenantId, scopeOpts);
    if (!qualifyBuyerEligible(body.status, lead.phone)) {
      throw new BadRequestException({ error: 'qualify_status' });
    }
    const needJson = normalizeNeedJson(body.need_json ?? lead.meta_json.need_json);
    const buyer = await this.buyerRepo.upsertBuyer({
      tenantId,
      fullName: lead.full_name,
      phoneE164: normalizePhoneE164(lead.phone),
      email: lead.email,
      budgetVnd: body.budget_vnd ?? null,
      needJson,
    });
    await this.leadRepo.setLeadStatus(leadId, body.status);
    await this.leadRepo.patchLeadMeta(leadId, {
      buyer_id: buyer.id,
      need_json: needJson,
    });
    const updated = await this.leadRepo.getLeadForScope(leadId);
    if (!updated) throw new NotFoundException();
    return { lead: updated, buyer_id: buyer.id };
  }

  async recordTouch(
    leadId: number,
    tenantId: string,
    scopeOpts: { staffId?: number; agencyId?: string; viewAll?: boolean } = {},
  ): Promise<{ touched_at: string }> {
    await this.getLeadOrThrow(leadId, tenantId, scopeOpts);
    const touchedAt = new Date().toISOString();
    await this.leadRepo.patchLeadMeta(leadId, { touched_at: touchedAt });
    return { touched_at: touchedAt };
  }

  async syncHoldActive(leadId: number): Promise<void> {
    const lead = await this.leadRepo.getLeadForScope(leadId);
    if (!lead) return;
    if (String(lead.meta_json.lead_flow_kind ?? '') !== 're_buyer') return;
    if (lead.status === 'giu_cho') return;
    await this.leadRepo.setLeadStatus(leadId, 'giu_cho');
  }

  private async getLeadOrThrow(
    leadId: number,
    tenantId: string,
    scopeOpts: { staffId?: number; agencyId?: string; viewAll?: boolean },
  ): Promise<BuyerLeadRow> {
    const lead = await this.leadRepo.getLeadForScope(leadId);
    if (!lead || lead.tenant_id !== tenantId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (String(lead.meta_json.lead_flow_kind ?? '') !== 're_buyer') {
      throw new NotFoundException({ error: 'not_found' });
    }
    await this.scope.assertVisible({
      lead,
      staffId: scopeOpts.staffId,
      agencyId: scopeOpts.agencyId,
      viewAll: scopeOpts.viewAll,
    });
    return lead;
  }
}
