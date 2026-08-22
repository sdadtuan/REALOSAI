import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { coerceUnitPool, type BdsUnitPool, type BdsUnitStatus } from './bds-inventory.types';

export type SqliteProductMirror = {
  id: number;
  project_id: number;
  unit_code?: string;
  tower?: string;
  floor?: string;
  product_line?: string;
  zone?: string;
  typology?: string;
  is_corner?: number | boolean;
  sales_staff_id?: number | null;
  product_type?: string;
  area_m2?: number | null;
  bedrooms?: number | null;
  direction?: string;
  view_type?: string;
  list_price_vnd?: number;
  net_price_vnd?: number;
  status?: string;
  notes?: string;
  price_batch?: string;
  hold_lead_id?: number | null;
  hold_at?: string;
  pool?: string;
};

/** Import-only PG ids sit at/above this floor so SQLite AUTOINCREMENT never collides. */
export const PG_IMPORT_ID_FLOOR = 1_000_000_000;

const UPSERT_SQL = `
INSERT INTO crm_re_project_products (
  id, project_id, tenant_id, unit_code, tower, floor, product_line, zone, typology,
  is_corner, sales_staff_id, product_type, area_m2, bedrooms, direction, view_type,
  list_price_vnd, net_price_vnd, status, notes, price_batch, hold_lead_id, hold_at, pool, updated_at
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  project_id = EXCLUDED.project_id,
  tenant_id = COALESCE(crm_re_project_products.tenant_id, EXCLUDED.tenant_id),
  unit_code = EXCLUDED.unit_code,
  tower = EXCLUDED.tower,
  floor = EXCLUDED.floor,
  product_line = EXCLUDED.product_line,
  zone = EXCLUDED.zone,
  typology = EXCLUDED.typology,
  is_corner = EXCLUDED.is_corner,
  sales_staff_id = EXCLUDED.sales_staff_id,
  product_type = EXCLUDED.product_type,
  area_m2 = EXCLUDED.area_m2,
  bedrooms = EXCLUDED.bedrooms,
  direction = EXCLUDED.direction,
  view_type = EXCLUDED.view_type,
  list_price_vnd = EXCLUDED.list_price_vnd,
  net_price_vnd = EXCLUDED.net_price_vnd,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  price_batch = EXCLUDED.price_batch,
  hold_lead_id = EXCLUDED.hold_lead_id,
  hold_at = EXCLUDED.hold_at,
  pool = EXCLUDED.pool,
  row_version = crm_re_project_products.row_version + 1,
  updated_at = NOW();
`;

@Injectable()
export class BdsReProductPgRepository implements OnModuleDestroy {
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

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    return res.rows[0]?.tenant_id != null ? String(res.rows[0].tenant_id) : null;
  }

  async upsertFromSqlite(row: SqliteProductMirror): Promise<void> {
    const tenantId = await this.resolveProjectTenantId(row.project_id);
    const pool = coerceUnitPool(row.pool);
    await this.db.query(UPSERT_SQL, [
      row.id,
      row.project_id,
      tenantId,
      String(row.unit_code ?? ''),
      String(row.tower ?? ''),
      String(row.floor ?? ''),
      String(row.product_line ?? ''),
      String(row.zone ?? ''),
      String(row.typology ?? ''),
      Boolean(row.is_corner),
      row.sales_staff_id ?? null,
      String(row.product_type ?? ''),
      row.area_m2 ?? null,
      row.bedrooms ?? null,
      String(row.direction ?? ''),
      String(row.view_type ?? ''),
      Number(row.list_price_vnd ?? 0),
      Number(row.net_price_vnd ?? 0),
      String(row.status ?? 'available'),
      String(row.notes ?? ''),
      String(row.price_batch ?? ''),
      row.hold_lead_id ?? null,
      String(row.hold_at ?? ''),
      pool,
    ]);
  }

  async getById(id: number): Promise<Record<string, unknown> | null> {
    const res = await this.db.query(`SELECT * FROM crm_re_project_products WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  async listByProject(projectId: number): Promise<Record<string, unknown>[]> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_products
       WHERE project_id = $1
       ORDER BY tower, floor, unit_code`,
      [projectId],
    );
    return res.rows;
  }

  async findByUnitCode(projectId: number, unitCode: string): Promise<Record<string, unknown> | null> {
    const res = await this.db.query(
      `SELECT * FROM crm_re_project_products
       WHERE project_id = $1 AND lower(trim(unit_code)) = lower(trim($2))
       LIMIT 1`,
      [projectId, unitCode],
    );
    return res.rows[0] ?? null;
  }

  async transitionOptimistic(
    id: number,
    expectedVersion: number,
    nextStatus: BdsUnitStatus,
  ): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE crm_re_project_products
       SET status = $3, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND row_version = $2`,
      [id, expectedVersion, nextStatus],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async setLockNoteIfEmpty(id: number, note: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_re_project_products
       SET notes = $2
       WHERE id = $1 AND (notes IS NULL OR trim(notes) = '')`,
      [id, note],
    );
  }

  async updatePool(id: number, pool: BdsUnitPool, expectedVersion: number): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE crm_re_project_products
       SET pool = $3, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND row_version = $2`,
      [id, expectedVersion, pool],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async insertImported(row: {
    id: number;
    project_id: number;
    tenant_id: string | null;
    unit_code: string;
    tower: string;
    floor: string;
    zone: string;
    product_line: string;
    pool: BdsUnitPool;
    status: BdsUnitStatus;
    list_price_vnd: number;
    net_price_vnd: number;
    area_m2: number | null;
    bedrooms: number | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_re_project_products (
         id, project_id, tenant_id, unit_code, tower, floor, zone, product_line,
         pool, status, list_price_vnd, net_price_vnd, area_m2, bedrooms
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id,
        row.project_id,
        row.tenant_id,
        row.unit_code,
        row.tower,
        row.floor,
        row.zone,
        row.product_line,
        row.pool,
        row.status,
        row.list_price_vnd,
        row.net_price_vnd,
        row.area_m2,
        row.bedrooms,
      ],
    );
  }

  async nextId(): Promise<number> {
    const res = await this.db.query(
      `SELECT GREATEST(COALESCE(MAX(id), 0) + 1, ${PG_IMPORT_ID_FLOOR}) AS n FROM crm_re_project_products`,
    );
    return Number(res.rows[0].n);
  }

  async countAll(): Promise<number> {
    const res = await this.db.query(`SELECT COUNT(*)::int AS n FROM crm_re_project_products`);
    return Number(res.rows[0].n);
  }

  async setHoldPointers(
    productId: number,
    ptr: { hold_id: string | null; hold_lead_id: number | null; hold_at: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_re_project_products
       SET hold_id = $2, hold_lead_id = $3, hold_at = $4, updated_at = NOW()
       WHERE id = $1`,
      [productId, ptr.hold_id, ptr.hold_lead_id, ptr.hold_at],
    );
  }
}
