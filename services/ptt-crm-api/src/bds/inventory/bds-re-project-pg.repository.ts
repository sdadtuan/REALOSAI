import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { ReProjectRow } from '../../re-projects/re-projects.types';

const UPSERT_FROM_SQLITE_SQL = `
INSERT INTO crm_re_projects (id, code, name, status, developer_name, tenant_id, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  developer_name = EXCLUDED.developer_name,
  updated_at = NOW();
`;

const LEGACY_TENANT_CODE = 'PTT-RE-LEGACY';

@Injectable()
export class BdsReProjectPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private cachedLegacyTenantId: string | null | undefined;

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

  private async resolveLegacyTenantId(): Promise<string | null> {
    const fromEnv = process.env.PTT_BDS_LEGACY_TENANT_ID?.trim();
    if (fromEnv) return fromEnv;
    if (this.cachedLegacyTenantId !== undefined) return this.cachedLegacyTenantId;
    const res = await this.db.query(
      `SELECT id FROM bds_tenants WHERE code = $1 LIMIT 1`,
      [LEGACY_TENANT_CODE],
    );
    const id = res.rows[0]?.id != null ? String(res.rows[0].id) : null;
    this.cachedLegacyTenantId = id;
    return id;
  }

  async upsertFromSqlite(row: ReProjectRow): Promise<void> {
    const tenantId = await this.resolveLegacyTenantId();
    await this.db.query(UPSERT_FROM_SQLITE_SQL, [
      row.id,
      row.code,
      row.name,
      row.status,
      row.developer_name,
      tenantId,
    ]);
  }
}
