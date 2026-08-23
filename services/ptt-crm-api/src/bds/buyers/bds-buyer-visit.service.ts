import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { BdsBuyerRepository } from './bds-buyer.repository';
import { BdsBuyerLeadRepository } from './bds-buyer-lead.repository';
import type { CreateVisitBody, SiteVisitRow } from './bds-buyer.types';
import { BdsBuyerLeadScopeService } from './bds-buyer-lead-scope.service';
import { BdsCapiHookService } from '../commission/bds-capi-hook.service';

const POST_CONTACT_STATUSES = new Set([
  'da_lien_he',
  'xem_nha',
  'giu_cho',
  'dat_coc',
  'vbtt',
  'hdmb',
]);

@Injectable()
export class BdsBuyerVisitService {
  private readonly logger = new Logger(BdsBuyerVisitService.name);

  constructor(
    private readonly leadRepo: BdsBuyerLeadRepository,
    private readonly buyerRepo: BdsBuyerRepository,
    private readonly scope: BdsBuyerLeadScopeService,
    @Optional() private readonly capi?: BdsCapiHookService | null,
  ) {}

  async createVisit(
    leadId: number,
    body: CreateVisitBody,
    tenantId: string,
    scopeOpts: { staffId?: number; agencyId?: string; viewAll?: boolean } = {},
  ): Promise<SiteVisitRow> {
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

    const scheduledAt = new Date(body.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({ error: 'scheduled_at' });
    }
    if (!Number.isInteger(body.staff_id) || body.staff_id <= 0) {
      throw new BadRequestException({ error: 'staff_id' });
    }

    const visit = await this.buyerRepo.insertVisit({
      tenantId,
      leadId,
      productId: body.product_id ?? null,
      staffId: body.staff_id,
      scheduledAt,
      note: body.note,
    });

    const st = String(lead.status ?? '').trim().toLowerCase();
    if (POST_CONTACT_STATUSES.has(st) && st !== 'xem_nha') {
      await this.leadRepo.setLeadStatus(leadId, 'xem_nha');
    } else if (st === 'moi') {
      await this.leadRepo.setLeadStatus(leadId, 'xem_nha');
    }

    try {
      await this.capi?.onSchedule({ tenantId, leadId, visitId: visit.id });
    } catch (err) {
      this.logger.warn(`capi schedule hook failed visit=${visit.id}: ${String(err)}`);
    }

    return visit;
  }

  async listVisits(leadId: number, tenantId: string): Promise<SiteVisitRow[]> {
    const lead = await this.leadRepo.getLeadForScope(leadId);
    if (!lead || lead.tenant_id !== tenantId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    return this.buyerRepo.listVisitsByLead(leadId);
  }
}
