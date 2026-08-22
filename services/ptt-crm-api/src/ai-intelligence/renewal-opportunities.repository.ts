import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  RenewalOpportunityRecord,
  RenewalRiskLevel,
  RenewalStatus,
} from './renewal.types';

function mapRow(row: Record<string, unknown>): RenewalOpportunityRecord {
  return {
    id: String(row.id ?? ''),
    client_id: String(row.client_id ?? ''),
    contract_ref: String(row.contract_ref ?? ''),
    renewal_date: String(row.renewal_date ?? '').slice(0, 10),
    risk_level: String(row.risk_level ?? 'medium') as RenewalRiskLevel,
    status: String(row.status ?? 'open') as RenewalStatus,
    owner_am_id: (row.owner_am_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

@Injectable()
export class RenewalOpportunitiesRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'renewal_opportunities'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async findByContractRef(clientId: string, contractRef: string): Promise<RenewalOpportunityRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM renewal_opportunities
       WHERE client_id = $1::uuid AND contract_ref = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [clientId, contractRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async listByClient(clientId: string, limit = 20): Promise<RenewalOpportunityRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM renewal_opportunities
       WHERE client_id = $1::uuid
       ORDER BY renewal_date ASC, created_at DESC
       LIMIT $2`,
      [clientId, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<RenewalOpportunityRecord | null> {
    const result = await this.db.query(`SELECT * FROM renewal_opportunities WHERE id = $1::uuid LIMIT 1`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async insert(args: {
    clientId: string;
    contractRef: string;
    renewalDate: string;
    riskLevel: RenewalRiskLevel;
    ownerAmId?: string | null;
    metadata: Record<string, unknown>;
  }): Promise<RenewalOpportunityRecord> {
    const result = await this.db.query(
      `INSERT INTO renewal_opportunities (
         client_id, contract_ref, renewal_date, risk_level, status, owner_am_id, metadata
       ) VALUES ($1::uuid, $2, $3::date, $4, 'open', $5, $6::jsonb)
       RETURNING *`,
      [
        args.clientId,
        args.contractRef,
        args.renewalDate,
        args.riskLevel,
        args.ownerAmId ?? null,
        JSON.stringify(args.metadata),
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<RenewalOpportunityRecord | null> {
    const result = await this.db.query(
      `UPDATE renewal_opportunities
       SET metadata = $2::jsonb, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [id, JSON.stringify(metadata)],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async patchStatus(
    id: string,
    status: RenewalStatus,
    metadataPatch?: Record<string, unknown>,
  ): Promise<RenewalOpportunityRecord | null> {
    if (metadataPatch && Object.keys(metadataPatch).length) {
      const result = await this.db.query(
        `UPDATE renewal_opportunities
         SET status = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING *`,
        [id, status, JSON.stringify(metadataPatch)],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    }

    const result = await this.db.query(
      `UPDATE renewal_opportunities
       SET status = $2, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [id, status],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async countOpenByTriggerWindow(): Promise<{ t90: number; t60: number; t30: number }> {
    const empty = { t90: 0, t60: 0, t30: 0 };
    if (!(await this.tableReady())) return empty;
    try {
      const result = await this.db.query<{ tw: string; cnt: string }>(
        `SELECT COALESCE(metadata->>'trigger_window', '90') AS tw, COUNT(*)::text AS cnt
         FROM renewal_opportunities
         WHERE status IN ('open', 'in_progress')
         GROUP BY 1`,
      );
      const counts = { ...empty };
      for (const row of result.rows) {
        const tw = Number(row.tw);
        const cnt = Number(row.cnt);
        if (tw === 90) counts.t90 = cnt;
        else if (tw === 60) counts.t60 = cnt;
        else if (tw === 30) counts.t30 = cnt;
      }
      return counts;
    } catch {
      return empty;
    }
  }
}
