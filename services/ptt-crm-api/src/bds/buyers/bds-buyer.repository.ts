import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  BuyerRow,
  InsertVisitInput,
  SiteVisitRow,
  UpsertBuyerInput,
} from './bds-buyer.types';

@Injectable()
export class BdsBuyerRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private mapBuyer(row: Record<string, unknown>): BuyerRow {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      full_name: String(row.full_name ?? ''),
      phone_e164: String(row.phone_e164 ?? ''),
      email: String(row.email ?? ''),
      id_number: String(row.id_number ?? ''),
      budget_vnd: row.budget_vnd != null ? Number(row.budget_vnd) : null,
      need_json: (row.need_json as Record<string, unknown>) ?? {},
      created_at: new Date(String(row.created_at)),
      updated_at: new Date(String(row.updated_at)),
    };
  }

  private mapVisit(row: Record<string, unknown>): SiteVisitRow {
    return {
      id: String(row.id),
      tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
      lead_id: Number(row.lead_id),
      product_id: row.product_id != null ? Number(row.product_id) : null,
      staff_id: Number(row.staff_id),
      scheduled_at: new Date(String(row.scheduled_at)),
      outcome: String(row.outcome) as SiteVisitRow['outcome'],
      note: String(row.note ?? ''),
      created_at: new Date(String(row.created_at)),
    };
  }

  async upsertBuyer(input: UpsertBuyerInput): Promise<BuyerRow> {
    const res = await this.db.query(
      `INSERT INTO bds_buyers (
         tenant_id, full_name, phone_e164, email, budget_vnd, need_json, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT (tenant_id, phone_e164)
       WHERE phone_e164 <> ''
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         budget_vnd = COALESCE(EXCLUDED.budget_vnd, bds_buyers.budget_vnd),
         need_json = EXCLUDED.need_json,
         updated_at = NOW()
       RETURNING *`,
      [
        input.tenantId,
        input.fullName,
        input.phoneE164,
        input.email ?? '',
        input.budgetVnd ?? null,
        JSON.stringify(input.needJson ?? {}),
      ],
    );
    return this.mapBuyer(res.rows[0] as Record<string, unknown>);
  }

  async getBuyer(id: string, tenantId?: string): Promise<BuyerRow | null> {
    const params: unknown[] = [id];
    let sql = `SELECT * FROM bds_buyers WHERE id = $1`;
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $2`;
    }
    const res = await this.db.query(sql, params);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapBuyer(row) : null;
  }

  async insertVisit(input: InsertVisitInput): Promise<SiteVisitRow> {
    const res = await this.db.query(
      `INSERT INTO bds_site_visits (
         tenant_id, lead_id, product_id, staff_id, scheduled_at, outcome, note
       ) VALUES ($1, $2, $3, $4, $5, 'planned', $6)
       RETURNING *`,
      [
        input.tenantId ?? null,
        input.leadId,
        input.productId ?? null,
        input.staffId,
        input.scheduledAt,
        input.note ?? '',
      ],
    );
    return this.mapVisit(res.rows[0] as Record<string, unknown>);
  }

  async listVisitsByLead(leadId: number): Promise<SiteVisitRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_site_visits WHERE lead_id = $1 ORDER BY scheduled_at DESC`,
      [leadId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapVisit(row));
  }
}
