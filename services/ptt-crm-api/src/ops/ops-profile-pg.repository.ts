import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { OpsRouteMapService, OpsServiceProfileRow } from './ops.types';

function iso(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapProfileRow(row: Record<string, unknown>): OpsServiceProfileRow {
  return {
    id: Number(row.id),
    dv_code: String(row.dv_code ?? ''),
    service_slug: String(row.service_slug ?? ''),
    name: String(row.name ?? ''),
    readiness: String(row.readiness ?? 'partial') as OpsServiceProfileRow['readiness'],
    service_slugs_json: parseJson(row.service_slugs_json, {}),
    ops_web_json: parseJson(row.ops_web_json, {}),
    nest_api_json: parseJson(row.nest_api_json, {}),
    weekly_process_template: parseJson(row.weekly_process_template, []),
    kpi_definitions: parseJson(row.kpi_definitions, []),
    tier_pricing: parseJson(row.tier_pricing, {}),
  };
}

@Injectable()
export class OpsProfilePgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      if (!this.config.databaseUrl) {
        throw new Error('ops_pg_requires_database_url');
      }
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  canUsePg(): boolean {
    return Boolean(this.config.databaseUrl?.trim());
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.canUsePg()) return;
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      ALTER TABLE crm_catalog_services
        ADD COLUMN IF NOT EXISTS dv_code VARCHAR(8) NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_catalog_services_dv_code
        ON crm_catalog_services (dv_code)
        WHERE dv_code IS NOT NULL;

      CREATE TABLE IF NOT EXISTS ops_service_profile (
        id SERIAL PRIMARY KEY,
        dv_code VARCHAR(8) NOT NULL UNIQUE,
        service_slug VARCHAR(80) NOT NULL,
        name VARCHAR(200) NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        readiness VARCHAR(20) NOT NULL DEFAULT 'partial'
          CHECK (readiness IN ('ready', 'partial', 'gap')),
        service_slugs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        ops_web_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        nest_api_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        weekly_process_template JSONB NOT NULL DEFAULT '[]'::jsonb,
        kpi_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
        tier_pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
        depends_on_dv JSONB NOT NULL DEFAULT '[]'::jsonb,
        gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ops_service_profile_slug
        ON ops_service_profile (service_slug);
    `);
  }

  async countProfiles(): Promise<number> {
    if (!this.canUsePg()) return 0;
    await this.ensureSchema();
    const res = await this.db.query(`SELECT COUNT(*)::int AS c FROM ops_service_profile`);
    return Number(res.rows[0]?.c ?? 0);
  }

  async listProfiles(): Promise<OpsServiceProfileRow[]> {
    if (!this.canUsePg()) return [];
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT * FROM ops_service_profile WHERE active = TRUE ORDER BY sort_order ASC, dv_code ASC`,
    );
    return res.rows.map((row) => mapProfileRow(row as Record<string, unknown>));
  }

  async getByDvCode(dvCode: string): Promise<OpsServiceProfileRow | null> {
    if (!this.canUsePg()) return null;
    await this.ensureSchema();
    const res = await this.db.query(`SELECT * FROM ops_service_profile WHERE dv_code = $1 LIMIT 1`, [
      dvCode.toUpperCase(),
    ]);
    const row = res.rows[0];
    return row ? mapProfileRow(row as Record<string, unknown>) : null;
  }

  async upsertFromRouteEntry(entry: OpsRouteMapService): Promise<void> {
    if (!this.canUsePg()) return;
    await this.ensureSchema();
    const sortOrder = Number(String(entry.code).replace('DV', '')) || 0;
    await this.db.query(
      `INSERT INTO ops_service_profile
         (dv_code, service_slug, name, readiness, service_slugs_json, ops_web_json, nest_api_json,
          depends_on_dv, gaps, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (dv_code) DO UPDATE SET
         service_slug = EXCLUDED.service_slug,
         name = EXCLUDED.name,
         readiness = EXCLUDED.readiness,
         service_slugs_json = EXCLUDED.service_slugs_json,
         ops_web_json = EXCLUDED.ops_web_json,
         nest_api_json = EXCLUDED.nest_api_json,
         depends_on_dv = EXCLUDED.depends_on_dv,
         gaps = EXCLUDED.gaps,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [
        entry.code,
        entry.service_slugs.primary,
        entry.name_vi,
        entry.readiness,
        JSON.stringify(entry.service_slugs),
        JSON.stringify(entry.ops_web ?? {}),
        JSON.stringify(entry.nest_api ?? {}),
        JSON.stringify(entry.depends_on_dv ?? []),
        JSON.stringify(entry.gaps ?? []),
        sortOrder,
      ],
    );

    await this.db.query(
      `INSERT INTO crm_catalog_services (slug, name, dv_code, sort_order, active)
       VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (slug) DO UPDATE SET
         dv_code = EXCLUDED.dv_code,
         name = EXCLUDED.name,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [entry.service_slugs.primary, entry.name_vi, entry.code, sortOrder],
    );
  }

  async syncFromRouteMap(entries: OpsRouteMapService[]): Promise<number> {
    if (!this.canUsePg()) return 0;
    let count = 0;
    for (const entry of entries) {
      await this.upsertFromRouteEntry(entry);
      count += 1;
    }
    return count;
  }
}
