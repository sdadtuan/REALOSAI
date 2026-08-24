import { Injectable, Optional } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LeadsFunnelPgRepository } from '../leads-funnel/leads-funnel-pg.repository';
import { PgLeadsRepository } from './pg-leads.repository';
import { LeadV1, ListLeadsQuery } from './leads.types';

@Injectable()
export class LeadsRepository {
  constructor(
    private readonly config: AppConfigService,
    private readonly pgRepo: PgLeadsRepository,
    @Optional() private readonly funnelPgRepo?: LeadsFunnelPgRepository,
  ) {}

  async listLeads(query: ListLeadsQuery): Promise<{ leads: LeadV1[]; total: number }> {
    const enriched = await this.withReviewQueueFilter(query);
    return this.pgRepo.listLeads(enriched);
  }

  getLeadById(leadId: number): Promise<LeadV1 | null> {
    return this.pgRepo.getLeadById(leadId);
  }

  private async withReviewQueueFilter(query: ListLeadsQuery): Promise<ListLeadsQuery> {
    const filter = query.review_queue_filter;
    if (!filter || !this.config.crmLeadsFunnelNest) {
      return query;
    }
    if (this.config.crmLeadsFunnelPg && this.funnelPgRepo) {
      return { ...query, review_queue_ids: await this.funnelPgRepo.listReviewQueueLeadIds() };
    }
    return { ...query, review_queue_ids: [] };
  }
}
