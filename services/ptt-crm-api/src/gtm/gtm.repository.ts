import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  GtmDemoRequestRow,
  GrantGtmSandboxPatch,
  InsertGtmDemoInput,
  ListGtmDemoQuery,
  PatchGtmDemoBody,
} from './gtm.types';
import type { GtmStatus } from './gtm-status.util';

function rowToDemo(row: Record<string, unknown>): GtmDemoRequestRow {
  return {
    id: String(row.id),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    locale: row.locale as GtmDemoRequestRow['locale'],
    full_name: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone),
    company: String(row.company),
    industry: row.industry as GtmDemoRequestRow['industry'],
    sku_interest: row.sku_interest as GtmDemoRequestRow['sku_interest'],
    company_size: row.company_size != null ? String(row.company_size) : null,
    message: row.message != null ? String(row.message) : null,
    landing_path: String(row.landing_path),
    utm_source: row.utm_source != null ? String(row.utm_source) : null,
    utm_medium: row.utm_medium != null ? String(row.utm_medium) : null,
    utm_campaign: row.utm_campaign != null ? String(row.utm_campaign) : null,
    utm_content: row.utm_content != null ? String(row.utm_content) : null,
    utm_term: row.utm_term != null ? String(row.utm_term) : null,
    status: row.status as GtmStatus,
    status_note: row.status_note != null ? String(row.status_note) : null,
    owner_user_id: row.owner_user_id != null ? String(row.owner_user_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    sandbox_expires_at:
      row.sandbox_expires_at instanceof Date
        ? row.sandbox_expires_at.toISOString()
        : row.sandbox_expires_at != null
          ? String(row.sandbox_expires_at)
          : null,
    sandbox_user_id: row.sandbox_user_id != null ? String(row.sandbox_user_id) : null,
    ip_hash: String(row.ip_hash),
    market_country: row.market_country != null ? String(row.market_country) : null,
  };
}

@Injectable()
export class GtmRepository implements OnModuleDestroy {
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

  async insert(input: InsertGtmDemoInput): Promise<GtmDemoRequestRow> {
    const result = await this.db.query(
      `INSERT INTO gtm_demo_request (
         locale, full_name, email, phone, company, industry, sku_interest,
         company_size, message, landing_path,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         owner_user_id, lead_id, ip_hash, market_country
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18, $19
       )
       RETURNING *`,
      [
        input.locale,
        input.full_name,
        input.email,
        input.phone,
        input.company,
        input.industry,
        input.sku_interest,
        input.company_size ?? null,
        input.message ?? null,
        input.landing_path,
        input.utm_source ?? null,
        input.utm_medium ?? null,
        input.utm_campaign ?? null,
        input.utm_content ?? null,
        input.utm_term ?? null,
        input.owner_user_id,
        input.lead_id,
        input.ip_hash,
        input.market_country ?? null,
      ],
    );
    return rowToDemo(result.rows[0] as Record<string, unknown>);
  }

  async findLeadIdByEmailSince(email: string, since: Date): Promise<string | null> {
    const result = await this.db.query(
      `SELECT lead_id
       FROM gtm_demo_request
       WHERE lower(email) = lower($1)
         AND created_at >= $2
         AND lead_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, since],
    );
    const leadId = result.rows[0]?.lead_id;
    return leadId != null ? String(leadId) : null;
  }

  async lastOwnerId(): Promise<string | null> {
    const result = await this.db.query(
      `SELECT owner_user_id
       FROM gtm_demo_request
       WHERE owner_user_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    const ownerId = result.rows[0]?.owner_user_id;
    return ownerId != null ? String(ownerId) : null;
  }

  async getById(id: string): Promise<GtmDemoRequestRow | null> {
    const result = await this.db.query(`SELECT * FROM gtm_demo_request WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? rowToDemo(row as Record<string, unknown>) : null;
  }

  async list(query: ListGtmDemoQuery): Promise<{ rows: GtmDemoRequestRow[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const push = (clause: string, value: unknown) => {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    };

    if (query.status) push('status = ?', query.status);
    if (query.industry) push('industry = ?', query.industry);
    if (query.locale) push('locale = ?', query.locale);
    if (query.market_country) push('market_country = ?', query.market_country);
    if (query.owner_user_id) push('owner_user_id = ?', query.owner_user_id);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM gtm_demo_request ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    params.push(limit, offset);
    const listResult = await this.db.query(
      `SELECT * FROM gtm_demo_request ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      rows: listResult.rows.map((row) => rowToDemo(row as Record<string, unknown>)),
      total,
    };
  }

  async patch(id: string, body: PatchGtmDemoBody): Promise<GtmDemoRequestRow | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };

    if (body.status !== undefined) push('status = ?', body.status);
    if (body.status_note !== undefined) push('status_note = ?', body.status_note);
    if (body.owner_user_id !== undefined) push('owner_user_id = ?', body.owner_user_id);
    if (body.sandbox_user_id !== undefined) push('sandbox_user_id = ?', body.sandbox_user_id);
    if (body.sandbox_expires_at !== undefined) push('sandbox_expires_at = ?', body.sandbox_expires_at);

    if (sets.length === 1) {
      return this.getById(id);
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE gtm_demo_request SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    const row = result.rows[0];
    return row ? rowToDemo(row as Record<string, unknown>) : null;
  }

  async grantSandbox(id: string, patch: GrantGtmSandboxPatch): Promise<GtmDemoRequestRow | null> {
    const result = await this.db.query(
      `UPDATE gtm_demo_request
       SET updated_at = NOW(),
           sandbox_expires_at = $1,
           sandbox_user_id = $2,
           status = $3
       WHERE id = $4
       RETURNING *`,
      [patch.sandbox_expires_at, patch.sandbox_user_id, patch.status, id],
    );
    const row = result.rows[0];
    return row ? rowToDemo(row as Record<string, unknown>) : null;
  }

  async listExpiredSandboxes(now: Date): Promise<GtmDemoRequestRow[]> {
    const result = await this.db.query(
      `SELECT * FROM gtm_demo_request
       WHERE sandbox_expires_at IS NOT NULL
         AND sandbox_expires_at < $1
         AND sandbox_user_id IS NOT NULL
         AND status = 'sandbox_granted'`,
      [now],
    );
    return result.rows.map((row) => rowToDemo(row as Record<string, unknown>));
  }

  async pingDb(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async pingCmsTable(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1 FROM gtm_cms_article LIMIT 1');
      return true;
    } catch {
      return false;
    }
  }
}
