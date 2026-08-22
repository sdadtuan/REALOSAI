import { Injectable, Logger } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { AppConfigService } from '../config/app-config.service';
import { AgencyRepository } from '../agency/agency.repository';
import { CustomerHealthScoresRepository } from './customer-health-scores.repository';
import { serviceLabel } from './upsell.catalog';
import { UpsellActiveService, UpsellContext } from './upsell.types';
import { healthBand } from './upsell.engine';

@Injectable()
export class UpsellContextRepository {
  private readonly logger = new Logger(UpsellContextRepository.name);
  private db: DatabaseSync | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly agencyRepo: AgencyRepository,
    private readonly healthScores: CustomerHealthScoresRepository,
  ) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
    }
    return this.db;
  }

  async loadContext(clientId: string): Promise<UpsellContext | null> {
    const cid = clientId.trim();
    if (!cid) return null;

    const client = await this.agencyRepo.fetchClient(cid);
    if (!client) return null;

    const activeServices = this.listActiveServices(cid);
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

  listActiveClientIds(limit = 50, offset = 0): string[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT DISTINCT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
           FROM crm_contracts ct
           WHERE ct.status = 'active'
             AND TRIM(COALESCE(ct.agency_client_id, '')) != ''
           ORDER BY ct.updated_at DESC
           LIMIT ? OFFSET ?`,
        )
        .all(
          Math.min(Math.max(limit, 1), 200),
          Math.max(offset, 0),
        ) as Array<{ agency_client_id: string }>;
      return rows.map((r) => String(r.agency_client_id)).filter(Boolean);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to list active client IDs: ${message}`);
      return [];
    }
  }

  private listActiveServices(clientId: string): UpsellActiveService[] {
    try {
      const rows = this.database
        .prepare(
          `SELECT sl.id AS lifecycle_id,
                  sl.service_slug,
                  sl.stage,
                  COALESCE(ct.title, '') AS contract_title
           FROM crm_service_lifecycle sl
           JOIN crm_contracts ct ON ct.id = sl.contract_id
           WHERE ct.status = 'active'
             AND TRIM(COALESCE(ct.agency_client_id, '')) = ?
           ORDER BY sl.updated_at DESC, sl.id DESC`,
        )
        .all(clientId) as Array<Record<string, unknown>>;

      return rows.map((row) => {
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
