import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  CreateStaffDepartmentBody,
  CreateStaffTeamBody,
  PatchStaffDepartmentBody,
  PatchStaffOrgPositionBody,
  PatchStaffTeamBody,
  StaffDepartmentRow,
  StaffOrgAuditInput,
  StaffOrgChartNode,
  StaffOrgPositionRow,
  StaffTeamRow,
} from './staff-org.types';

function trimCode(code: string): string {
  return code.trim();
}

function mapDepartment(row: {
  id: string | number;
  code: string;
  name: string;
  parent_id: string | number | null;
  active: boolean;
}): StaffDepartmentRow {
  return {
    id: Number(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    parent_id: row.parent_id == null ? null : Number(row.parent_id),
    active: Boolean(row.active),
  };
}

function mapTeam(row: {
  id: string | number;
  code: string;
  name: string;
  department_id: string | number | null;
  department_code?: string | null;
  department_name?: string | null;
  active: boolean;
}): StaffTeamRow {
  return {
    id: Number(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    department_id: row.department_id == null ? null : Number(row.department_id),
    department_code: row.department_code ? String(row.department_code) : undefined,
    department_name: row.department_name ? String(row.department_name) : undefined,
    active: Boolean(row.active),
  };
}

function mapPosition(row: {
  id: string | number;
  code: string;
  name: string;
  parent_id: string | number | null;
  department_id: string | number | null;
  department_code?: string | null;
  active: boolean;
}): StaffOrgPositionRow {
  return {
    id: Number(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    parent_id: row.parent_id == null ? null : Number(row.parent_id),
    department_id: row.department_id == null ? null : Number(row.department_id),
    department_code: row.department_code ? String(row.department_code) : undefined,
    active: Boolean(row.active),
  };
}

export class StaffOrgRepository {
  constructor(private readonly db: Pool) {}

  private async writeAudit(input: StaffOrgAuditInput): Promise<void> {
    await this.db.query(
      `INSERT INTO staff_org_audit (actor_email, entity_type, entity_id, action, diff_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.actor_email,
        input.entity_type,
        input.entity_id,
        input.action,
        JSON.stringify(input.diff_json ?? {}),
      ],
    );
  }

  async listDepartments(): Promise<StaffDepartmentRow[]> {
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      parent_id: string | null;
      active: boolean;
    }>(
      `SELECT id, code, name, parent_id, active
       FROM crm_departments
       ORDER BY active DESC, name, code`,
    );
    return result.rows.map(mapDepartment);
  }

  async createDepartment(body: CreateStaffDepartmentBody, actorEmail: string): Promise<StaffDepartmentRow> {
    const code = trimCode(body.code);
    const name = String(body.name ?? '').trim();
    if (!code || !name) {
      throw new BadRequestException({ error: 'invalid_department', message: 'code and name required' });
    }
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      parent_id: string | null;
      active: boolean;
    }>(
      `INSERT INTO crm_departments (code, name, parent_id, active, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id, code, name, parent_id, active`,
      [code, name, body.parent_id ?? null],
    );
    const row = mapDepartment(result.rows[0]);
    await this.writeAudit({
      actor_email: actorEmail,
      entity_type: 'department',
      entity_id: String(row.id),
      action: 'create',
      diff_json: { code: row.code, name: row.name, parent_id: row.parent_id },
    });
    return row;
  }

  async patchDepartment(
    id: number,
    body: PatchStaffDepartmentBody,
    actorEmail: string,
  ): Promise<StaffDepartmentRow> {
    const existing = await this.getDepartment(id);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.code !== undefined) {
      sets.push(`code = $${idx++}`);
      params.push(trimCode(body.code));
    }
    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(String(body.name).trim());
    }
    if (body.parent_id !== undefined) {
      sets.push(`parent_id = $${idx++}`);
      params.push(body.parent_id);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(Boolean(body.active));
    }
    if (!sets.length) return existing;
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      parent_id: string | null;
      active: boolean;
    }>(
      `UPDATE crm_departments SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, code, name, parent_id, active`,
      params,
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'department_not_found', id });
    const row = mapDepartment(result.rows[0]);
    await this.writeAudit({
      actor_email: actorEmail,
      entity_type: 'department',
      entity_id: String(row.id),
      action: 'update',
      diff_json: body as Record<string, unknown>,
    });
    return row;
  }

  async getDepartment(id: number): Promise<StaffDepartmentRow> {
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      parent_id: string | null;
      active: boolean;
    }>(
      `SELECT id, code, name, parent_id, active FROM crm_departments WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'department_not_found', id });
    return mapDepartment(result.rows[0]);
  }

  async listTeams(departmentId?: number): Promise<StaffTeamRow[]> {
    const params: unknown[] = [];
    let where = '';
    if (departmentId != null && Number.isFinite(departmentId)) {
      where = 'WHERE t.department_id = $1';
      params.push(departmentId);
    }
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      department_id: string | null;
      department_code: string | null;
      department_name: string | null;
      active: boolean;
    }>(
      `SELECT t.id, t.code, t.name, t.department_id, d.code AS department_code, d.name AS department_name, t.active
       FROM staff_teams t
       LEFT JOIN crm_departments d ON d.id = t.department_id
       ${where}
       ORDER BY t.active DESC, t.name, t.code`,
      params,
    );
    return result.rows.map(mapTeam);
  }

  async createTeam(body: CreateStaffTeamBody, actorEmail: string): Promise<StaffTeamRow> {
    const code = trimCode(body.code);
    const name = String(body.name ?? '').trim();
    if (!code || !name) {
      throw new BadRequestException({ error: 'invalid_team', message: 'code and name required' });
    }
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO staff_teams (code, name, department_id, active, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id`,
      [code, name, body.department_id ?? null],
    );
    const id = Number(result.rows[0]?.id);
    const row = (await this.listTeams()).find((t) => t.id === id);
    if (!row) throw new NotFoundException({ error: 'team_not_found', id });
    await this.writeAudit({
      actor_email: actorEmail,
      entity_type: 'team',
      entity_id: String(row.id),
      action: 'create',
      diff_json: { code: row.code, name: row.name, department_id: row.department_id },
    });
    return row;
  }

  async patchTeam(id: number, body: PatchStaffTeamBody, actorEmail: string): Promise<StaffTeamRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.code !== undefined) {
      sets.push(`code = $${idx++}`);
      params.push(trimCode(body.code));
    }
    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(String(body.name).trim());
    }
    if (body.department_id !== undefined) {
      sets.push(`department_id = $${idx++}`);
      params.push(body.department_id);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(Boolean(body.active));
    }
    if (!sets.length) {
      const rows = await this.listTeams();
      const found = rows.find((t) => t.id === id);
      if (!found) throw new NotFoundException({ error: 'team_not_found', id });
      return found;
    }
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await this.db.query(
      `UPDATE staff_teams SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
    if ((result.rowCount ?? 0) === 0) throw new NotFoundException({ error: 'team_not_found', id });
    const row = (await this.listTeams()).find((t) => t.id === id);
    if (!row) throw new NotFoundException({ error: 'team_not_found', id });
    await this.writeAudit({
      actor_email: actorEmail,
      entity_type: 'team',
      entity_id: String(row.id),
      action: 'update',
      diff_json: body as Record<string, unknown>,
    });
    return row;
  }

  async listPositions(): Promise<StaffOrgPositionRow[]> {
    const result = await this.db.query<{
      id: string;
      code: string;
      name: string;
      parent_id: string | null;
      department_id: string | null;
      department_code: string | null;
      active: boolean;
    }>(
      `SELECT p.id, p.code, p.name, p.parent_id, p.department_id, d.code AS department_code, p.active
       FROM crm_positions p
       LEFT JOIN crm_departments d ON d.id = p.department_id
       ORDER BY p.active DESC, p.name, p.code`,
    );
    return result.rows.map(mapPosition);
  }

  async patchPosition(
    id: number,
    body: PatchStaffOrgPositionBody,
    actorEmail: string,
  ): Promise<StaffOrgPositionRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(String(body.name).trim());
    }
    if (body.parent_id !== undefined) {
      sets.push(`parent_id = $${idx++}`);
      params.push(body.parent_id);
    }
    if (body.department_id !== undefined) {
      sets.push(`department_id = $${idx++}`);
      params.push(body.department_id);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(Boolean(body.active));
    }
    if (!sets.length) {
      const rows = await this.listPositions();
      const found = rows.find((p) => p.id === id);
      if (!found) throw new NotFoundException({ error: 'position_not_found', id });
      return found;
    }
    sets.push('updated_at = NOW()');
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_positions SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
    if ((result.rowCount ?? 0) === 0) throw new NotFoundException({ error: 'position_not_found', id });
    const row = (await this.listPositions()).find((p) => p.id === id);
    if (!row) throw new NotFoundException({ error: 'position_not_found', id });
    await this.writeAudit({
      actor_email: actorEmail,
      entity_type: 'position',
      entity_id: String(row.id),
      action: 'update',
      diff_json: body as Record<string, unknown>,
    });
    return row;
  }

  async listOrgChart(includeInactive = false): Promise<StaffOrgChartNode[]> {
    const result = await this.db.query(
      `SELECT s.id,
              s.name,
              s.reports_to_id,
              COALESCE(s.department, '') AS department,
              COALESCE(s.job_title, '') AS job_title,
              COALESCE(s.active, true) AS active,
              p.code AS position_code
       FROM crm_staff s
       LEFT JOIN staff_users su ON lower(trim(su.email)) = lower(trim(s.email))
       LEFT JOIN crm_positions p ON p.id = su.position_id
       WHERE ($1::boolean OR COALESCE(s.active, true) = true)
       ORDER BY s.name ASC`,
      [includeInactive],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      reports_to_id: row.reports_to_id != null ? Number(row.reports_to_id) : null,
      department: String(row.department ?? ''),
      job_title: String(row.job_title ?? ''),
      position_code: row.position_code ? String(row.position_code) : null,
      active: Boolean(row.active),
    }));
  }
}
