import { ForbiddenException, Injectable } from '@nestjs/common';
import { MetaIntelligenceService } from '../meta-intelligence/meta-intelligence.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import type { MetaBudgetRecommendationsResponse } from '../meta-intelligence/meta-intelligence.types';

@Injectable()
export class BudgetRecommendService {
  constructor(
    private readonly metaIntel: MetaIntelligenceService,
    private readonly staffAuth: StaffAuthService,
    private readonly clientScope: StaffClientScopeService,
  ) {}

  async listRecommendations(input: {
    staffUser?: StaffJwtPayload;
    staffAuthVia?: 'internal' | 'jwt';
    client_id?: string;
    channel?: string;
    days?: string;
  }): Promise<MetaBudgetRecommendationsResponse & { read_only: true }> {
    const clientId = input.client_id?.trim() || undefined;
    if (input.staffAuthVia !== 'internal' && input.staffUser) {
      const me = await this.staffAuth.me(input.staffUser);
      if (!this.staffAuth.hasCap(me.caps, 'crm_meta_ads', 'view')) {
        throw new ForbiddenException({ error: 'missing_cap', section: 'crm_meta_ads', action: 'view' });
      }
      const scopeIds = await this.clientScope.resolveForJwt(me.id, me.position_id);
      const restricted = Boolean(scopeIds?.length);
      if (restricted && clientId && !scopeIds!.includes(clientId)) {
        throw new ForbiddenException({ error: 'client_scope_denied', client_id: clientId });
      }
    }

    const out = await this.metaIntel.listBudgetRecommendations({
      client_id: clientId,
      days: input.days,
    });
    return { ...out, read_only: true as const };
  }
}
