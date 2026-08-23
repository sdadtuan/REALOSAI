import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';

export type HoldRecordStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'converted'
  | 'rejected';

export type HoldRow = {
  id: string;
  tenant_id: string | null;
  project_id: number;
  product_id: number;
  lead_id: number;
  buyer_id: string | null;
  requested_by_staff_id: number | null;
  channel_partner_id: string;
  status: HoldRecordStatus;
  expires_at: Date | null;
  note: string;
  approved_by: string;
  approved_at: Date | null;
  cancelled_reason: string;
  created_at: Date;
  updated_at: Date;
};

export type InsertHoldInput = {
  tenant_id?: string | null;
  project_id: number;
  product_id: number;
  lead_id: number;
  buyer_id?: string | null;
  requested_by_staff_id?: number | null;
  channel_partner_id?: string;
  status: HoldRecordStatus;
  expires_at?: Date | null;
  note?: string;
};

export type ProjectHoldContext = {
  status: string;
  current_phase_id: string | null;
  settings_json: Record<string, unknown>;
};

export type IdempotencyRow = {
  route: string;
  key: string;
  request_hash: string;
  status_code: number;
  response_json: unknown;
  created_at: Date;
};

@Injectable()
export class BdsHoldRepository implements OnModuleDestroy {
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

  private optStr(value: unknown): string | null {
    return value != null ? String(value) : null;
  }

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private parseSettings(value: unknown): Record<string, unknown> {
    if (value == null) return {};
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private mapHold(row: Record<string, unknown>): HoldRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      project_id: Number(row.project_id),
      product_id: Number(row.product_id),
      lead_id: Number(row.lead_id),
      buyer_id: this.optStr(row.buyer_id),
      requested_by_staff_id:
        row.requested_by_staff_id == null ? null : Number(row.requested_by_staff_id),
      channel_partner_id: String(row.channel_partner_id ?? ''),
      status: String(row.status) as HoldRecordStatus,
      expires_at: this.optDate(row.expires_at),
      note: String(row.note ?? ''),
      approved_by: String(row.approved_by ?? ''),
      approved_at: this.optDate(row.approved_at),
      cancelled_reason: String(row.cancelled_reason ?? ''),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  async insertHold(row: InsertHoldInput): Promise<HoldRow> {
    const tenantId = String(row.tenant_id ?? '').trim() || null;
    try {
      const res = await this.db.query(
        `INSERT INTO bds_holds (
           tenant_id, project_id, product_id, lead_id, buyer_id, requested_by_staff_id,
           channel_partner_id, status, expires_at, note
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          tenantId,
          row.project_id,
          row.product_id,
          row.lead_id,
          row.buyer_id ?? null,
          row.requested_by_staff_id ?? null,
          String(row.channel_partner_id ?? ''),
          row.status,
          row.expires_at ?? null,
          String(row.note ?? ''),
        ],
      );
      return this.mapHold(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getHold(id: string): Promise<HoldRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_holds WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapHold(row) : null;
  }

  async listByProject(projectId: number): Promise<HoldRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_holds WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
  }

  async listOpenByProduct(productId: number): Promise<HoldRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_holds
       WHERE product_id = $1 AND status IN ('pending', 'active')
       ORDER BY created_at DESC`,
      [productId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
  }

  async listOpenByStaff(staffId: number): Promise<HoldRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_holds
       WHERE requested_by_staff_id = $1 AND status IN ('pending', 'active')
       ORDER BY created_at DESC`,
      [staffId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
  }

  async listByLeadIds(leadIds: number[]): Promise<HoldRow[]> {
    if (!leadIds.length) return [];
    const res = await this.db.query(
      `SELECT * FROM bds_holds
       WHERE lead_id = ANY($1::int[])
       ORDER BY updated_at DESC`,
      [leadIds],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
  }

  async setHoldStatus(
    id: string,
    status: HoldRecordStatus,
    reason?: string,
    extras?: {
      expires_at?: Date | null;
      approved_by?: string;
      approved_at?: Date | null;
    },
    expectedStatus?: HoldRecordStatus,
  ): Promise<HoldRow | null> {
    const res = await this.db.query(
      `UPDATE bds_holds
       SET status = $2,
           cancelled_reason = COALESCE($3, cancelled_reason),
           expires_at = COALESCE($4, expires_at),
           approved_by = COALESCE($5, approved_by),
           approved_at = COALESCE($6, approved_at),
           updated_at = NOW()
       WHERE id = $1 AND ($7::text IS NULL OR status = $7)
       RETURNING *`,
      [
        id,
        status,
        reason ?? null,
        extras?.expires_at !== undefined ? extras.expires_at : null,
        extras?.approved_by ?? null,
        extras?.approved_at !== undefined ? extras.approved_at : null,
        expectedStatus ?? null,
      ],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapHold(row) : null;
  }

  async setHoldStatusIf(
    id: string,
    next: HoldRecordStatus,
    extras: {
      reason?: string;
      expires_at?: Date | null;
      approved_by?: string;
      approved_at?: Date | null;
    } | undefined,
    expectedStatus: HoldRecordStatus,
  ): Promise<HoldRow | null> {
    return this.setHoldStatus(id, next, extras?.reason, extras, expectedStatus);
  }

  async listActiveDue(now: Date): Promise<HoldRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_holds
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= $1
       ORDER BY expires_at ASC`,
      [now],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapHold(row));
  }

  async getProjectHoldContext(projectId: number): Promise<ProjectHoldContext | null> {
    const res = await this.db.query(
      `SELECT p.status, p.current_phase_id, t.settings_json
       FROM crm_re_projects p
       LEFT JOIN bds_tenants t ON t.id = p.tenant_id
       WHERE p.id=$1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      status: String(row.status ?? ''),
      current_phase_id: this.optStr(row.current_phase_id),
      settings_json: this.parseSettings(row.settings_json),
    };
  }

  async getIdempotency(route: string, key: string): Promise<IdempotencyRow | null> {
    const res = await this.db.query(
      `SELECT route, key, request_hash, status_code, response_json, created_at
       FROM bds_idempotency_keys
       WHERE route = $1 AND key = $2
       LIMIT 1`,
      [route, key],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const body = row.response_json;
    return {
      route: String(row.route),
      key: String(row.key),
      request_hash: String(row.request_hash ?? ''),
      status_code: Number(row.status_code),
      response_json: typeof body === 'string' ? JSON.parse(body) : body,
      created_at: this.asDate(row.created_at),
    };
  }

  async putIdempotency(input: {
    route: string;
    key: string;
    status_code: number;
    response_json: unknown;
    request_hash?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO bds_idempotency_keys (route, key, request_hash, status_code, response_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (route, key) DO UPDATE SET
         status_code = EXCLUDED.status_code,
         response_json = EXCLUDED.response_json,
         created_at = NOW()`,
      [
        input.route,
        input.key,
        input.request_hash ?? '',
        input.status_code,
        JSON.stringify(input.response_json ?? {}),
      ],
    );
  }
}
