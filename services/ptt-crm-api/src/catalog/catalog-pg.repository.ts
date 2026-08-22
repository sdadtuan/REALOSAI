import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { catalogTs, normalizeCatalogSlug, validateCatalogSlug } from './catalog-slug.util';
import { industryTraitsFieldCount, normalizeIndustryTraits } from './catalog-traits.util';
import {
  AssignScopeRow,
  CatalogIndustryRow,
  CatalogPublicPayload,
  CatalogServiceRow,
  CreateAssignScopeBody,
  CreateCatalogIndustryBody,
  CreateCatalogServiceBody,
  PatchAssignScopeBody,
  PatchCatalogIndustryBody,
  PatchCatalogServiceBody,
  StaffOption,
} from './catalog.types';

const WILDCARD = '*';

const DEFAULT_INDUSTRIES = [
  { slug: 'spa', name: 'Spa & Beauty', description: 'Spa, thẩm mỹ, wellness', sort_order: 10 },
  { slug: 'bds', name: 'Bất động sản', description: 'BĐS, dự án, môi giới', sort_order: 20 },
  { slug: 'giao-duc', name: 'Giáo dục', description: 'Trường, trung tâm, EdTech', sort_order: 30 },
  { slug: 'fnb', name: 'F&B', description: 'Nhà hàng, cafe, F&B chain', sort_order: 40 },
  { slug: 'khac', name: 'Khác', description: 'Ngành khác / chưa phân loại', sort_order: 50 },
];

function iso(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseTraits(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

@Injectable()
export class CatalogPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

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
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_catalog_services (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL DEFAULT '',
        description VARCHAR(500) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_catalog_industries (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL DEFAULT '',
        description VARCHAR(500) NOT NULL DEFAULT '',
        traits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_staff_assign_scope (
        id SERIAL PRIMARY KEY,
        staff_id INT NOT NULL,
        industry_slug VARCHAR(80) NOT NULL DEFAULT '*',
        service_slug VARCHAR(80) NOT NULL DEFAULT '*',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (staff_id, industry_slug, service_slug)
      );
    `);

    const svc = await this.db.query(`SELECT COUNT(*)::int AS c FROM crm_catalog_services`);
    if (Number(svc.rows[0]?.c ?? 0) === 0) {
      await this.db.query(
        `INSERT INTO crm_catalog_services (slug, name, description, sort_order, active)
         VALUES ('lead-gen', 'Lead generation', '', 10, TRUE)
         ON CONFLICT (slug) DO NOTHING`,
      );
    }

    const ind = await this.db.query(`SELECT COUNT(*)::int AS c FROM crm_catalog_industries`);
    if (Number(ind.rows[0]?.c ?? 0) === 0) {
      for (const item of DEFAULT_INDUSTRIES) {
        await this.db.query(
          `INSERT INTO crm_catalog_industries
             (slug, name, description, traits_json, sort_order, active)
           VALUES ($1, $2, $3, '{}'::jsonb, $4, TRUE)
           ON CONFLICT (slug) DO NOTHING`,
          [item.slug, item.name, item.description, item.sort_order],
        );
      }
    }
  }

  private mapService(row: Record<string, unknown>): CatalogServiceRow {
    return {
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      active: Boolean(row.active),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  private mapIndustry(row: Record<string, unknown>): CatalogIndustryRow {
    const traits = parseTraits(row.traits_json);
    return {
      id: Number(row.id),
      slug: String(row.slug ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      traits: typeof traits === 'object' && traits !== null ? traits : {},
      sort_order: Number(row.sort_order ?? 0),
      active: Boolean(row.active),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async listServices(activeOnly = false): Promise<CatalogServiceRow[]> {
    await this.ensureSchema();
    const sql = activeOnly
      ? `SELECT * FROM crm_catalog_services WHERE active IS TRUE ORDER BY sort_order ASC, name ASC, id ASC`
      : `SELECT * FROM crm_catalog_services ORDER BY sort_order ASC, name ASC, id ASC`;
    const result = await this.db.query(sql);
    return result.rows.map((row) => this.mapService(row));
  }

  async listIndustries(activeOnly = false): Promise<CatalogIndustryRow[]> {
    await this.ensureSchema();
    const sql = activeOnly
      ? `SELECT * FROM crm_catalog_industries WHERE active IS TRUE ORDER BY sort_order ASC, name ASC, id ASC`
      : `SELECT * FROM crm_catalog_industries ORDER BY sort_order ASC, name ASC, id ASC`;
    const result = await this.db.query(sql);
    return result.rows.map((row) => this.mapIndustry(row));
  }

  async publicPayload(): Promise<CatalogPublicPayload> {
    const services = await this.listServices(true);
    const industries = await this.listIndustries(true);
    return {
      services,
      industries,
      service_slugs: services.map((s) => s.slug),
      service_labels: Object.fromEntries(services.map((s) => [s.slug, s.name])),
      industry_slugs: industries.map((i) => i.slug),
      industry_labels: Object.fromEntries(industries.map((i) => [i.slug, i.name])),
    };
  }

  async createService(body: CreateCatalogServiceBody): Promise<CatalogServiceRow> {
    await this.ensureSchema();
    const key = validateCatalogSlug(body.slug);
    const name = String(body.name ?? '').trim();
    if (!name) throw new Error('Tên dịch vụ bắt buộc.');
    const dup = await this.db.query(`SELECT id FROM crm_catalog_services WHERE slug = $1 LIMIT 1`, [key]);
    if (dup.rowCount) throw new Error(`Slug dịch vụ đã tồn tại: ${key}`);
    const result = await this.db.query(
      `INSERT INTO crm_catalog_services (slug, name, description, sort_order, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        key,
        name.slice(0, 200),
        String(body.description ?? '').trim().slice(0, 500),
        Number(body.sort_order ?? 0),
        body.active !== false,
      ],
    );
    return this.mapService(result.rows[0]);
  }

  async updateService(id: number, body: PatchCatalogServiceBody): Promise<CatalogServiceRow> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_catalog_services WHERE id = $1`, [id]);
    const row = existing.rows[0];
    if (!row) throw new Error('Không tìm thấy dịch vụ.');
    const name = String(body.name ?? row.name).trim();
    if (!name) throw new Error('Tên dịch vụ bắt buộc.');
    const result = await this.db.query(
      `UPDATE crm_catalog_services
       SET name = $2, description = $3, sort_order = $4, active = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name.slice(0, 200),
        String(body.description ?? row.description).trim().slice(0, 500),
        body.sort_order !== undefined ? Number(body.sort_order) : Number(row.sort_order),
        body.active !== undefined ? body.active : Boolean(row.active),
      ],
    );
    return this.mapService(result.rows[0]);
  }

  async createIndustry(body: CreateCatalogIndustryBody): Promise<CatalogIndustryRow> {
    await this.ensureSchema();
    const key = validateCatalogSlug(body.slug);
    const name = String(body.name ?? '').trim();
    if (!name) throw new Error('Tên ngành bắt buộc.');
    const dup = await this.db.query(`SELECT id FROM crm_catalog_industries WHERE slug = $1 LIMIT 1`, [key]);
    if (dup.rowCount) throw new Error(`Slug ngành đã tồn tại: ${key}`);
    const result = await this.db.query(
      `INSERT INTO crm_catalog_industries (slug, name, description, traits_json, sort_order, active)
       VALUES ($1, $2, $3, '{}'::jsonb, $4, $5)
       RETURNING *`,
      [
        key,
        name.slice(0, 200),
        String(body.description ?? '').trim().slice(0, 500),
        Number(body.sort_order ?? 0),
        body.active !== false,
      ],
    );
    return this.mapIndustry(result.rows[0]);
  }

  async updateIndustry(id: number, body: PatchCatalogIndustryBody): Promise<CatalogIndustryRow> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_catalog_industries WHERE id = $1`, [id]);
    const row = existing.rows[0];
    if (!row) throw new Error('Không tìm thấy ngành.');
    const name = String(body.name ?? row.name).trim();
    if (!name) throw new Error('Tên ngành bắt buộc.');
    let traitsJson = row.traits_json;
    if (body.traits !== undefined) {
      traitsJson = JSON.stringify(normalizeIndustryTraits(body.traits));
    }
    const result = await this.db.query(
      `UPDATE crm_catalog_industries
       SET name = $2, description = $3, sort_order = $4, active = $5, traits_json = $6::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name.slice(0, 200),
        String(body.description ?? row.description).trim().slice(0, 500),
        body.sort_order !== undefined ? Number(body.sort_order) : Number(row.sort_order),
        body.active !== undefined ? body.active : Boolean(row.active),
        typeof traitsJson === 'string' ? traitsJson : JSON.stringify(traitsJson ?? {}),
      ],
    );
    return this.mapIndustry(result.rows[0]);
  }

  async listAssignScopes(): Promise<{ scopes: AssignScopeRow[]; staff: StaffOption[] }> {
    await this.ensureSchema();
    return { scopes: [], staff: [] };
  }

  async createAssignScope(_body: CreateAssignScopeBody): Promise<AssignScopeRow> {
    throw new Error('Phân lead scope chưa hỗ trợ trên PG — dùng CRM staff legacy.');
  }

  async updateAssignScope(_id: number, _body: PatchAssignScopeBody): Promise<AssignScopeRow> {
    throw new Error('Phân lead scope chưa hỗ trợ trên PG — dùng CRM staff legacy.');
  }

  async deleteAssignScope(_id: number): Promise<void> {
    throw new Error('Phân lead scope chưa hỗ trợ trên PG — dùng CRM staff legacy.');
  }

  industryAddonCount(traits: Record<string, unknown> | undefined): number {
    return industryTraitsFieldCount(traits);
  }
}
