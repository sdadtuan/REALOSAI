import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  defaultBusinessPlan,
  defaultMarketingPlan,
  defaultSalesPlan,
  planToJson,
} from './re-projects-plan.util';
import type { CreateReProjectBody, ReProjectRow } from './re-projects.types';
import { PROJECT_STATUSES } from './re-projects.types';
import { mapPgProjectRow } from './re-projects-pg.mapper';

const SELECT_COLS = `
  id, code, name, status, project_type, district, city, location_address,
  developer_name, investor_name, description, notes, tenant_id,
  total_land_area_m2, total_units, sold_units, revenue_target_vnd,
  start_date, presale_date, handover_date,
  business_plan_json, marketing_plan_json, sales_plan_json,
  created_at, updated_at
`;

@Injectable()
export class ReProjectsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private cachedDefaultTenantId: string | null | undefined;

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

  private async resolveDefaultTenantId(): Promise<string | null> {
    const fromEnv = (process.env.PTT_BDS_DEFAULT_TENANT_ID ?? '').trim();
    if (fromEnv) return fromEnv;
    if (this.cachedDefaultTenantId !== undefined) return this.cachedDefaultTenantId;
    const legacy = (process.env.PTT_BDS_LEGACY_TENANT_ID ?? '').trim();
    if (legacy) {
      this.cachedDefaultTenantId = legacy;
      return legacy;
    }
    const res = await this.db.query(
      `SELECT id FROM bds_tenants WHERE status = 'active' ORDER BY created_at ASC LIMIT 1`,
    );
    const id = res.rows[0]?.id != null ? String(res.rows[0].id) : null;
    this.cachedDefaultTenantId = id;
    return id;
  }

  async listProjects(q = ''): Promise<ReProjectRow[]> {
    const term = q.trim();
    const params: unknown[] = [];
    let where = '';
    if (term) {
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
      where = ` WHERE name ILIKE $1 OR code ILIKE $2 OR district ILIKE $3`;
    }
    const res = await this.db.query(
      `SELECT ${SELECT_COLS} FROM crm_re_projects${where} ORDER BY updated_at DESC, id DESC`,
      params,
    );
    return (res.rows as Record<string, unknown>[]).map(mapPgProjectRow);
  }

  async fetchProject(projectId: number): Promise<ReProjectRow | null> {
    const res = await this.db.query(
      `SELECT ${SELECT_COLS} FROM crm_re_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapPgProjectRow(row) : null;
  }

  async createProject(payload: CreateReProjectBody): Promise<ReProjectRow> {
    const name = String(payload.name ?? '').trim();
    if (!name) throw new Error('Thiếu tên dự án.');
    const tenantId = await this.resolveDefaultTenantId();
    let st = String(payload.status ?? 'planning');
    if (!(PROJECT_STATUSES as readonly string[]).includes(st)) st = 'planning';
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const idRes = await client.query<{ next_id: string }>(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM crm_re_projects`,
      );
      const nextId = Number(idRes.rows[0]?.next_id ?? 1);
      const res = await client.query(
        `INSERT INTO crm_re_projects (
           id, code, name, status, project_type, district, city, location_address,
           developer_name, investor_name, description, notes, tenant_id,
           total_land_area_m2, total_units, sold_units, revenue_target_vnd,
           start_date, presale_date, handover_date,
           business_plan_json, marketing_plan_json, sales_plan_json,
           updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
           $14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,NOW()
         )
         RETURNING ${SELECT_COLS}`,
        [
          nextId,
          String(payload.code ?? '').slice(0, 40),
          name.slice(0, 240),
          st,
          String(payload.project_type ?? 'can_ho'),
          String(payload.district ?? '').slice(0, 120),
          String(payload.city ?? '').slice(0, 120),
          String(payload.location_address ?? '').slice(0, 500),
          String(payload.developer_name ?? '').slice(0, 240),
          String(payload.investor_name ?? '').slice(0, 240),
          String(payload.description ?? ''),
          String(payload.notes ?? ''),
          tenantId,
          payload.total_land_area_m2 ?? null,
          Number(payload.total_units ?? 0),
          Number(payload.sold_units ?? 0),
          Number(payload.revenue_target_vnd ?? 0),
          String(payload.start_date ?? '').slice(0, 10),
          String(payload.presale_date ?? '').slice(0, 10),
          String(payload.handover_date ?? '').slice(0, 10),
          planToJson(payload.business_plan, defaultBusinessPlan()),
          planToJson(payload.marketing_plan, defaultMarketingPlan()),
          planToJson(payload.sales_plan, defaultSalesPlan()),
        ],
      );
      await client.query('COMMIT');
      return mapPgProjectRow(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateProject(projectId: number, payload: CreateReProjectBody): Promise<ReProjectRow> {
    const prev = await this.fetchProject(projectId);
    if (!prev) throw new Error('Không tìm thấy dự án.');
    const name = String(payload.name ?? prev.name).trim();
    if (!name) throw new Error('Thiếu tên dự án.');
    const merged = { ...prev, ...payload } as Record<string, unknown>;
    let st = String(merged.status ?? prev.status);
    if (!(PROJECT_STATUSES as readonly string[]).includes(st)) st = prev.status;
    const bp = 'business_plan' in payload ? payload.business_plan : prev.business_plan;
    const mp = 'marketing_plan' in payload ? payload.marketing_plan : prev.marketing_plan;
    const sp = 'sales_plan' in payload ? payload.sales_plan : prev.sales_plan;

    const res = await this.db.query(
      `UPDATE crm_re_projects SET
         code = $2, name = $3, status = $4, project_type = $5,
         district = $6, city = $7, location_address = $8,
         developer_name = $9, investor_name = $10,
         description = $11, notes = $12,
         total_land_area_m2 = $13, total_units = $14, sold_units = $15,
         revenue_target_vnd = $16, start_date = $17, presale_date = $18, handover_date = $19,
         business_plan_json = $20::jsonb, marketing_plan_json = $21::jsonb, sales_plan_json = $22::jsonb,
         updated_at = NOW()
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [
        projectId,
        String(merged.code ?? prev.code).slice(0, 40),
        name.slice(0, 240),
        st,
        String(merged.project_type ?? prev.project_type),
        String(merged.district ?? prev.district).slice(0, 120),
        String(merged.city ?? prev.city).slice(0, 120),
        String(merged.location_address ?? prev.location_address).slice(0, 500),
        String(merged.developer_name ?? prev.developer_name).slice(0, 240),
        String(merged.investor_name ?? prev.investor_name).slice(0, 240),
        String(merged.description ?? prev.description),
        String(merged.notes ?? prev.notes),
        merged.total_land_area_m2 != null ? Number(merged.total_land_area_m2) : null,
        Number(merged.total_units ?? prev.total_units ?? 0),
        Number(merged.sold_units ?? prev.sold_units ?? 0),
        Number(merged.revenue_target_vnd ?? prev.revenue_target_vnd ?? 0),
        String(merged.start_date ?? prev.start_date ?? '').slice(0, 10),
        String(merged.presale_date ?? prev.presale_date ?? '').slice(0, 10),
        String(merged.handover_date ?? prev.handover_date ?? '').slice(0, 10),
        planToJson(bp, defaultBusinessPlan()),
        planToJson(mp, defaultMarketingPlan()),
        planToJson(sp, defaultSalesPlan()),
      ],
    );
    if (!res.rows[0]) throw new Error('Không tìm thấy dự án.');
    return mapPgProjectRow(res.rows[0] as Record<string, unknown>);
  }

  async deleteProject(projectId: number): Promise<void> {
    const res = await this.db.query(`DELETE FROM crm_re_projects WHERE id = $1`, [projectId]);
    if ((res.rowCount ?? 0) === 0) throw new Error('Không tìm thấy dự án.');
  }
}
