import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { CreateReProjectBody, ReProjectRow } from './re-projects.types';
import { mapPgProjectRow } from './re-projects-pg.mapper';

const SELECT_COLS = `
  id, code, name, status, project_type, district, city, location_address,
  developer_name, investor_name, description, notes, tenant_id,
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
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const idRes = await client.query<{ next_id: string }>(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM crm_re_projects`,
      );
      const nextId = Number(idRes.rows[0]?.next_id ?? 1);
      const status = String(payload.status ?? 'planning');
      const res = await client.query(
        `INSERT INTO crm_re_projects (
           id, code, name, status, project_type, district, city, location_address,
           developer_name, investor_name, description, notes, tenant_id, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
         RETURNING ${SELECT_COLS}`,
        [
          nextId,
          String(payload.code ?? '').slice(0, 40),
          name.slice(0, 240),
          status,
          String(payload.project_type ?? 'can_ho'),
          String(payload.district ?? '').slice(0, 120),
          String(payload.city ?? '').slice(0, 120),
          String(payload.location_address ?? '').slice(0, 500),
          String(payload.developer_name ?? '').slice(0, 240),
          String(payload.investor_name ?? '').slice(0, 240),
          String(payload.description ?? ''),
          String(payload.notes ?? ''),
          tenantId,
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
    const res = await this.db.query(
      `UPDATE crm_re_projects SET
         code = $2, name = $3, status = $4, project_type = $5,
         district = $6, city = $7, location_address = $8,
         developer_name = $9, investor_name = $10,
         description = $11, notes = $12, updated_at = NOW()
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [
        projectId,
        String(payload.code ?? prev.code).slice(0, 40),
        name.slice(0, 240),
        String(payload.status ?? prev.status),
        String(payload.project_type ?? prev.project_type),
        String(payload.district ?? prev.district).slice(0, 120),
        String(payload.city ?? prev.city).slice(0, 120),
        String(payload.location_address ?? prev.location_address).slice(0, 500),
        String(payload.developer_name ?? prev.developer_name).slice(0, 240),
        String(payload.investor_name ?? prev.investor_name).slice(0, 240),
        String(payload.description ?? prev.description),
        String(payload.notes ?? prev.notes),
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
