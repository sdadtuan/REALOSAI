import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AgencyRepository } from '../agency/agency.repository';
import { CustomerHealthScoresRepository } from './customer-health-scores.repository';
import { serviceLabel } from './upsell.catalog';
import { UpsellActiveService, UpsellContext } from './upsell.types';
import { healthBand } from './upsell.engine';

@Injectable()
export class UpsellContextRepository implements OnModuleDestroy {
  private readonly logger = new Logger(UpsellContextRepository.name);
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly agencyRepo: AgencyRepository,
    private readonly healthScores: CustomerHealthScoresRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async loadContext(clientId: string): Promise<UpsellContext | null> {
    const cid = clientId.trim();
    if (!cid) return null;

    const client = await this.agencyRepo.fetchClient(cid);
    if (!client) return null;

    const activeServices = await this.listActiveServices(cid);
    const channels = await this.listChannels(cid);
    let healthScore: number | null = null;
    if (await this.healthScores.tableReady()) {
      const latest = await this.healthScores.findLatestByClient(cid);
      healthScore = latest?.score ?? null;
    }

    return {
      clientId: cid,
      clientName: client.name ?? null,
      healthScore,
      healthBand: healthBand(healthScore),
      activeServices,
      channels,
      ownedServiceSlugs: activeServices.map((s) => s.service_slug),
    };
  }

  async listActiveClientIds(limit = 50, offset = 0): Promise<string[]> {
    try {
      const result = await this.db.query(
        `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
         FROM crm_contracts ct
         WHERE ct.status = 'active'
           AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
         GROUP BY agency_client_id
         ORDER BY MAX(ct.updated_at) DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)],
      );
      return (result.rows as Array<{ agency_client_id: string }>)
        .map((r) => String(r.agency_client_id))
        .filter(Boolean);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to list active client IDs: ${message}`);
      return [];
    }
  }

  private async listActiveServices(clientId: string): Promise<UpsellActiveService[]> {
    try {
      const result = await this.db.query(
        `SELECT sl.id AS lifecycle_id,
                sl.service_slug,
                sl.stage,
                COALESCE(ct.title, '') AS contract_title
         FROM crm_service_lifecycle sl
         JOIN crm_contracts ct ON ct.id = sl.contract_id
         WHERE ct.status = 'active'
           AND TRIM(COALESCE(ct.agency_client_id, '')) = $1
         ORDER BY sl.updated_at DESC, sl.id DESC`,
        [clientId],
      );
      return (result.rows as Array<Record<string, unknown>>).map((row) => {
        const slug = String(row.service_slug ?? '').trim();
        return {
          lifecycle_id: Number(row.lifecycle_id),
          service_slug: slug,
          service_label: serviceLabel(slug),
          contract_title: String(row.contract_title ?? ''),
          stage: String(row.stage ?? ''),
        };
      });
    } catch {
      return [];
    }
  }

  private async listChannels(clientId: string): Promise<string[]> {
    try {
      const accounts = await this.agencyRepo.listChannelAccounts(clientId);
      return [...new Set(accounts.map((a) => String(a.channel).toLowerCase()).filter(Boolean))];
    } catch {
      return [];
    }
  }
}
