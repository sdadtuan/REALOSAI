import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { BdsTenantMode, BdsTenantRow, BdsTenantStatus } from './bds-tenant.types';

@Injectable()
export class BdsTenantRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private mapRow(row: Record<string, unknown>): BdsTenantRow {
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      mode: String(row.mode) as BdsTenantMode,
      status: String(row.status) as BdsTenantStatus,
      operated_by_ptt: Boolean(row.operated_by_ptt),
    };
  }

  async insert(input: {
    code: string;
    name: string;
    mode: BdsTenantMode;
    operated_by_ptt?: boolean;
  }): Promise<BdsTenantRow> {
    const res = await this.db.query(
      `INSERT INTO bds_tenants (code, name, mode, status, operated_by_ptt)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING id, code, name, mode, status, operated_by_ptt`,
      [input.code, input.name, input.mode, input.operated_by_ptt ?? false],
    );
    return this.mapRow(res.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<BdsTenantRow | null> {
    const res = await this.db.query(
      `SELECT id, code, name, mode, status, operated_by_ptt
       FROM bds_tenants
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getByCode(code: string): Promise<BdsTenantRow | null> {
    const res = await this.db.query(
      `SELECT id, code, name, mode, status, operated_by_ptt
       FROM bds_tenants
       WHERE code = $1
       LIMIT 1`,
      [code],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async setStatus(id: string, status: BdsTenantStatus): Promise<BdsTenantRow> {
    const res = await this.db.query(
      `UPDATE bds_tenants
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, code, name, mode, status, operated_by_ptt`,
      [id, status],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error('bds_tenant_not_found');
    return this.mapRow(row);
  }
}
