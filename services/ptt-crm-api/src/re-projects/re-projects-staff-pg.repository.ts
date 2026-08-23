import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  PRODUCT_LINE_LABELS,
  PROJECT_STAFF_ROLE_LABELS,
  PROJECT_STAFF_ROLES,
  type ReProjectStaffRow,
  type UpdateProjectStaffBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsStaffPgRepository implements OnModuleDestroy {
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

  private normalizeRole(role: string): string {
    const r = role.trim().toLowerCase();
    return (PROJECT_STAFF_ROLES as readonly string[]).includes(r) ? r : 'sales';
  }

  private scopeJson(lines?: string[]): string {
    const arr = Array.isArray(lines) ? lines.filter(Boolean) : [];
    return JSON.stringify(arr);
  }

  private parseScope(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private enrichRow(r: Record<string, unknown>): ReProjectStaffRow {
    const role = this.normalizeRole(String(r.role ?? 'sales'));
    const scopeLines = this.parseScope(r.scope_product_lines);
    const scopeZones = this.parseScope(r.scope_zones);
    return {
      id: Number(r.id),
      project_id: Number(r.project_id),
      staff_id: Number(r.staff_id),
      staff_name: String(r.staff_name ?? ''),
      staff_code: String(r.staff_code ?? ''),
      role,
      role_label: PROJECT_STAFF_ROLE_LABELS[role] ?? role,
      assign_enabled: Boolean(r.assign_enabled ?? true),
      sort_order: Number(r.sort_order ?? 0),
      scope_product_lines: scopeLines,
      scope_zones: scopeZones,
      scope_product_lines_label: scopeLines.length
        ? scopeLines.map((x) => PRODUCT_LINE_LABELS[x] ?? x).join(', ')
        : 'Tất cả dòng SP',
      scope_zones_label: scopeZones.length ? scopeZones.join(', ') : 'Tất cả phân khu',
      joined_at: r.joined_at instanceof Date ? r.joined_at.toISOString() : String(r.joined_at ?? ''),
      left_at: r.left_at != null ? String(r.left_at) : null,
      active: r.left_at == null,
    };
  }

  async listProjectStaff(projectId: number, activeOnly = true): Promise<ReProjectStaffRow[]> {
    const proj = await this.db.query(`SELECT 1 FROM crm_re_projects WHERE id = $1`, [projectId]);
    if (!proj.rows[0]) throw new Error('Không tìm thấy dự án.');
    const where = activeOnly ? 'AND ps.left_at IS NULL' : '';
    const res = await this.db.query(
      `SELECT ps.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_re_project_staff ps
       JOIN crm_staff s ON s.id = ps.staff_id
       WHERE ps.project_id = $1 ${where}
       ORDER BY ps.sort_order ASC, ps.id ASC`,
      [projectId],
    );
    return res.rows.map((r) => this.enrichRow(r as Record<string, unknown>));
  }

  async addProjectStaff(
    projectId: number,
    payload: {
      staff_id: number;
      role?: string;
      assign_enabled?: boolean | number | string;
      sort_order?: number;
      scope_product_lines?: string[];
      scope_zones?: string[];
    },
  ): Promise<ReProjectStaffRow> {
    const proj = await this.db.query(`SELECT 1 FROM crm_re_projects WHERE id = $1`, [projectId]);
    if (!proj.rows[0]) throw new Error('Không tìm thấy dự án.');
    const sid = Number(payload.staff_id);
    const staff = await this.db.query(
      `SELECT id FROM crm_staff WHERE id = $1 AND COALESCE(active, TRUE) = TRUE`,
      [sid],
    );
    if (!staff.rows[0]) throw new Error('Nhân viên không hợp lệ hoặc đã ngưng.');
    const roleNorm = this.normalizeRole(String(payload.role ?? 'sales'));
    const assignEnabled = !(payload.assign_enabled === false || payload.assign_enabled === 0);
    const sortOrder = Number(payload.sort_order ?? 0);
    const scopeLines = this.scopeJson(payload.scope_product_lines);
    const scopeZones = this.scopeJson(payload.scope_zones);
    const existing = await this.db.query(
      `SELECT id FROM crm_re_project_staff WHERE project_id = $1 AND staff_id = $2`,
      [projectId, sid],
    );
    let rowId: number;
    if (existing.rows[0]) {
      rowId = Number(existing.rows[0].id);
      await this.db.query(
        `UPDATE crm_re_project_staff SET
           role = $3, assign_enabled = $4, sort_order = $5,
           scope_product_lines = $6::jsonb, scope_zones = $7::jsonb,
           left_at = NULL, joined_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [rowId, projectId, roleNorm, assignEnabled, sortOrder, scopeLines, scopeZones],
      );
    } else {
      const ins = await this.db.query(
        `INSERT INTO crm_re_project_staff (
           project_id, staff_id, role, assign_enabled, sort_order,
           scope_product_lines, scope_zones
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
         RETURNING id`,
        [projectId, sid, roleNorm, assignEnabled, sortOrder, scopeLines, scopeZones],
      );
      rowId = Number(ins.rows[0].id);
    }
    const row = await this.db.query(
      `SELECT ps.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_re_project_staff ps
       JOIN crm_staff s ON s.id = ps.staff_id
       WHERE ps.id = $1`,
      [rowId],
    );
    return this.enrichRow(row.rows[0] as Record<string, unknown>);
  }

  async updateProjectStaff(
    projectId: number,
    staffId: number,
    body: UpdateProjectStaffBody,
  ): Promise<ReProjectStaffRow> {
    const found = await this.db.query(
      `SELECT id FROM crm_re_project_staff
       WHERE project_id = $1 AND staff_id = $2 AND left_at IS NULL`,
      [projectId, staffId],
    );
    if (!found.rows[0]) throw new Error('Nhân viên không còn trong dự án.');
    const rowId = Number(found.rows[0].id);
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [rowId, projectId];
    let i = 3;
    if (body.role != null) {
      sets.push(`role = $${i++}`);
      params.push(this.normalizeRole(String(body.role)));
    }
    if (body.assign_enabled != null) {
      sets.push(`assign_enabled = $${i++}`);
      params.push(!(body.assign_enabled === false || body.assign_enabled === 0));
    }
    if (body.sort_order != null) {
      sets.push(`sort_order = $${i++}`);
      params.push(Number(body.sort_order));
    }
    if (body.scope_product_lines != null) {
      sets.push(`scope_product_lines = $${i++}::jsonb`);
      params.push(this.scopeJson(body.scope_product_lines));
    }
    if (body.scope_zones != null) {
      sets.push(`scope_zones = $${i++}::jsonb`);
      params.push(this.scopeJson(body.scope_zones));
    }
    await this.db.query(
      `UPDATE crm_re_project_staff SET ${sets.join(', ')} WHERE id = $1 AND project_id = $2`,
      params,
    );
    const row = await this.db.query(
      `SELECT ps.*, s.name AS staff_name, s.internal_code AS staff_code
       FROM crm_re_project_staff ps JOIN crm_staff s ON s.id = ps.staff_id WHERE ps.id = $1`,
      [rowId],
    );
    return this.enrichRow(row.rows[0] as Record<string, unknown>);
  }

  async removeProjectStaff(projectId: number, staffId: number): Promise<void> {
    const res = await this.db.query(
      `UPDATE crm_re_project_staff SET left_at = NOW(), updated_at = NOW()
       WHERE project_id = $1 AND staff_id = $2 AND left_at IS NULL`,
      [projectId, staffId],
    );
    if ((res.rowCount ?? 0) === 0) throw new Error('Nhân viên không còn trong dự án.');
  }
}
