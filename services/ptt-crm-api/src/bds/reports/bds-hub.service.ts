import { Injectable, NotFoundException } from '@nestjs/common';
import { BdsTenantService } from '../tenant/bds-tenant.service';
import type { HubResponse, LeaderboardRow } from './bds-hub.types';
import { BdsHubRepository } from './bds-hub.repository';
import { clampInbox, periodMonthStart } from './bds-hub.util';

@Injectable()
export class BdsHubService {
  constructor(
    private readonly tenants: BdsTenantService,
    private readonly repo: BdsHubRepository,
  ) {}

  async getHub(tenantId: string): Promise<HubResponse> {
    const tenant = await this.tenants.getMe(tenantId);
    if (tenant.mode === 'broker') {
      throw new NotFoundException();
    }

    const kpi = await this.repo.kpi(tenant.id);
    const pending = await this.repo.pendingHolds(tenant.id);
    let byTower: HubResponse['sell_through_by_tower'] = [];
    let byAgency: HubResponse['sell_through_by_agency'] = [];
    try {
      byTower = await this.repo.byTower(tenant.id);
    } catch {
      byTower = [];
    }
    try {
      byAgency = await this.repo.byAgency(tenant.id);
    } catch {
      byAgency = [];
    }

    return {
      tenant_id: tenant.id,
      mode: tenant.mode,
      kpi,
      inbox: clampInbox(pending),
      sell_through_by_tower: byTower,
      sell_through_by_agency: byAgency,
    };
  }

  async listLeaderboard(period: string, tenantId: string): Promise<LeaderboardRow[]> {
    await this.tenants.getMe(tenantId);
    const month = periodMonthStart(period);
    return this.repo.listLeaderboard(tenantId, month);
  }
}
