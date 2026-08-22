import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPortalPassword } from '../portal/portal-password.util';
import type {
  CreateStaffOrgUserBody,
  OffboardStaffOrgUserBody,
  PatchStaffOrgUserBody,
  StaffOrgUserDetail,
  StaffOrgUserSummary,
} from './staff-org.types';
import type { StaffOrgAuditInput } from './staff-org.types';
import { nextInternalCodeFromMax } from './staff-org-internal-code.util';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

function mapUserSummary(row: {
  id: string;
  email: string;
  display_name: string;
  position_id: string | number;
  position_code: string | null;
  active: boolean;
  crm_staff_id: string | number | null;
  team_ids: number[] | null;
  team_codes: string[] | null;
  job_functions?: string[];
}): StaffOrgUserSummary {
  return {
    id: String(row.id),
    email: String(row.email),
    display_name: String(row.display_name || row.email),
    position_id: Number(row.position_id),
    position_code: row.position_code ? String(row.position_code) : undefined,
    active: Boolean(row.active),
    crm_staff_id: row.crm_staff_id != null ? Number(row.crm_staff_id) : undefined,
    team_ids: row.team_ids ?? [],
    team_codes: row.team_codes ?? [],
    job_functions: row.job_functions ?? [],
  };
}

export class StaffOrgUsersRepository {
  constructor(private readonly db: Pool) {}

  async nextInternalCode(client?: Pool | PoolClient): Promise<string> {
    const db = client ?? this.db;
    const result = await db.query<{ max_seq: string | null }>(
      `SELECT MAX(CAST(substring(upper(trim(internal_code)) from 6) AS BIGINT)) AS max_seq
       FROM crm_staff
       WHERE upper(trim(internal_code)) ~ '^PTTCN[0-9]+$'`,
    );
    const maxSeq = result.rows[0]?.max_seq != null ? Number(result.rows[0].max_seq) : null;
    return nextInternalCodeFromMax(Number.isFinite(maxSeq) ? maxSeq : null);
  }

  private async resolveInternalCode(
    client: PoolClient,
    provided?: string,
  ): Promise<string> {
    const trimmed = String(provided ?? '').trim().toUpperCase();
    if (trimmed) return trimmed;
    return this.nextInternalCode(client);
  }

  private async writeAudit(client: Pool | PoolClient, input: StaffOrgAuditInput): Promise<void> {
    await client.query(
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

  private userListSql(includeInactive: boolean): string {
    const activeFilter = includeInactive ? '' : 'WHERE u.active IS TRUE';
    return `
      SELECT u.id::text, u.email, u.display_name, u.position_id, u.active,
             p.code AS position_code,
             cs.id AS crm_staff_id,
             COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}') AS team_ids,
             COALESCE(array_agg(DISTINCT t.code) FILTER (WHERE t.code IS NOT NULL), '{}') AS team_codes
      FROM staff_users u
      LEFT JOIN crm_positions p ON p.id = u.position_id
      LEFT JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
      LEFT JOIN staff_user_teams sut ON sut.user_id = u.id
      LEFT JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
      ${activeFilter}
      GROUP BY u.id, u.email, u.display_name, u.position_id, u.active, p.code, cs.id
      ORDER BY u.active DESC, u.display_name, u.email`;
  }

  async listUsers(opts?: { q?: string; includeInactive?: boolean }): Promise<StaffOrgUserSummary[]> {
    const includeInactive = Boolean(opts?.includeInactive);
    const q = String(opts?.q ?? '').trim().toLowerCase();
    const result = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      position_id: string;
      position_code: string | null;
      active: boolean;
      crm_staff_id: string | null;
      team_ids: number[];
      team_codes: string[];
    }>(this.userListSql(includeInactive));

    let rows = result.rows.map((row) =>
      mapUserSummary({
        ...row,
        team_ids: (row.team_ids ?? []).map(Number).filter((n) => n > 0),
        team_codes: row.team_codes ?? [],
      }),
    );

    if (q) {
      rows = rows.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          r.display_name.toLowerCase().includes(q) ||
          (r.position_code ?? '').toLowerCase().includes(q),
      );
    }
    return rows;
  }

  async getUserById(userId: string): Promise<StaffOrgUserDetail | null> {
    const result = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      position_id: string;
      position_code: string | null;
      active: boolean;
      crm_staff_id: string | null;
      team_ids: number[];
      team_codes: string[];
    }>(
      `SELECT u.id::text, u.email, u.display_name, u.position_id, u.active,
              p.code AS position_code,
              cs.id AS crm_staff_id,
              COALESCE(array_agg(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}') AS team_ids,
              COALESCE(array_agg(DISTINCT t.code) FILTER (WHERE t.code IS NOT NULL), '{}') AS team_codes
       FROM staff_users u
       LEFT JOIN crm_positions p ON p.id = u.position_id
       LEFT JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(u.email))
       LEFT JOIN staff_user_teams sut ON sut.user_id = u.id
       LEFT JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
       WHERE u.id = $1::uuid
       GROUP BY u.id, u.email, u.display_name, u.position_id, u.active, p.code, cs.id`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return mapUserSummary({
      ...row,
      team_ids: (row.team_ids ?? []).map(Number).filter((n) => n > 0),
      team_codes: row.team_codes ?? [],
    });
  }

  private async assertPosition(positionId: number, client: Pool | PoolClient): Promise<void> {
    const hit = await client.query(
      `SELECT id FROM crm_positions WHERE id = $1 AND active IS TRUE LIMIT 1`,
      [positionId],
    );
    if (!hit.rows[0]) {
      throw new BadRequestException({ error: 'invalid_position', position_id: positionId });
    }
  }

  private async replaceUserTeams(
    client: PoolClient,
    userId: string,
    teamIds: number[],
  ): Promise<void> {
    const unique = [...new Set(teamIds.filter((id) => Number.isFinite(id) && id > 0))];
    await client.query(`DELETE FROM staff_user_teams WHERE user_id = $1::uuid`, [userId]);
    for (const teamId of unique) {
      await client.query(
        `INSERT INTO staff_user_teams (user_id, team_id, assigned_at)
         VALUES ($1::uuid, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, teamId],
      );
    }
  }

  private async upsertCrmStaff(
    client: PoolClient,
    email: string,
    profile: NonNullable<CreateStaffOrgUserBody['crm_staff']>,
    positionId: number,
  ): Promise<number> {
    const name = String(profile.name ?? profile.display_name ?? email).trim();
    if (!name) throw new BadRequestException({ error: 'crm_staff_name_required' });

    const posDept = await client.query<{ department_id: number | null }>(
      `SELECT department_id FROM crm_positions WHERE id = $1 LIMIT 1`,
      [positionId],
    );
    const departmentId =
      profile.department_id ?? posDept.rows[0]?.department_id ?? null;
    const internalCode = await this.resolveInternalCode(client, profile.internal_code);

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM crm_staff WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
      [email],
    );
    if (existing.rows[0]) {
      const id = Number(existing.rows[0].id);
      await client.query(
        `UPDATE crm_staff
         SET name = $1, phone = COALESCE($2, phone), job_title = COALESCE($3, job_title),
             internal_code = COALESCE(NULLIF($4, ''), internal_code),
             department_id = COALESCE($5, department_id), position_id = $6,
             active = TRUE, updated_at = NOW()
         WHERE id = $7`,
        [
          name,
          profile.phone ?? null,
          profile.job_title ?? null,
          internalCode,
          departmentId,
          positionId,
          id,
        ],
      );
      return id;
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO crm_staff (
         name, phone, email, job_title, internal_code, department_id, position_id,
         active, created_at, updated_at, started_on
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW(), CURRENT_DATE)
       RETURNING id`,
      [
        name,
        profile.phone ?? '',
        email,
        profile.job_title ?? '',
        internalCode,
        departmentId,
        positionId,
      ],
    );
    return Number(inserted.rows[0]!.id);
  }

  async createUser(
    body: CreateStaffOrgUserBody,
    actorEmail: string,
  ): Promise<{ user: StaffOrgUserDetail; temp_password?: string }> {
    const email = normalizeEmail(body.email ?? '');
    const displayName = String(body.display_name ?? '').trim() || email.split('@')[0] || email;
    const positionId = Number(body.position_id);
    if (!email || !email.includes('@')) {
      throw new BadRequestException({ error: 'invalid_email' });
    }
    if (!Number.isFinite(positionId) || positionId <= 0) {
      throw new BadRequestException({ error: 'invalid_position' });
    }

    const dup = await this.db.query(`SELECT 1 FROM staff_users WHERE lower(trim(email)) = $1 LIMIT 1`, [
      email,
    ]);
    if (dup.rows[0]) {
      throw new ConflictException({ error: 'email_exists', email });
    }

    let plainPassword = String(body.password ?? '').trim();
    let tempPassword: string | undefined;
    if (!plainPassword) {
      plainPassword = generateTempPassword();
      tempPassword = plainPassword;
    }
    const passwordHash = hashPortalPassword(plainPassword);
    const teamIds = (body.team_ids ?? []).map(Number).filter((n) => n > 0);
    const accountKind = normalizeAccountKind(body.account_kind);
    const expiresAt = body.expires_at ? String(body.expires_at).trim() : null;
    if ((accountKind === 'guest' || accountKind === 'contractor') && !expiresAt) {
      throw new BadRequestException({ error: 'expires_at_required', account_kind: accountKind });
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.assertPosition(positionId, client);

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO staff_users (email, password_hash, display_name, position_id, active, account_kind, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6::timestamptz, NOW(), NOW())
         RETURNING id::text`,
        [email, passwordHash, displayName, positionId, accountKind, expiresAt],
      );
      const userId = String(inserted.rows[0]!.id);

      if (body.crm_staff_id != null) {
        const crmId = Number(body.crm_staff_id);
        await client.query(
          `UPDATE crm_staff SET email = $1, position_id = $2, active = TRUE, updated_at = NOW()
           WHERE id = $3`,
          [email, positionId, crmId],
        );
      } else if (body.crm_staff) {
        await this.upsertCrmStaff(client, email, body.crm_staff, positionId);
      }

      if (teamIds.length) {
        await this.replaceUserTeams(client, userId, teamIds);
      }

      await this.writeAudit(client, {
        actor_email: actorEmail,
        entity_type: 'user',
        entity_id: userId,
        action: 'create',
        diff_json: {
          email,
          display_name: displayName,
          position_id: positionId,
          team_ids: teamIds,
          account_kind: accountKind,
          expires_at: expiresAt,
        },
      });

      await client.query('COMMIT');

      const user = await this.getUserById(userId);
      if (!user) throw new NotFoundException({ error: 'user_not_found' });
      return { user, temp_password: tempPassword };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async patchUser(
    userId: string,
    body: PatchStaffOrgUserBody,
    actorEmail: string,
  ): Promise<StaffOrgUserDetail> {
    const existing = await this.getUserById(userId);
    if (!existing) throw new NotFoundException({ error: 'user_not_found', id: userId });

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.display_name !== undefined) {
        sets.push(`display_name = $${idx++}`);
        params.push(String(body.display_name).trim());
      }
      if (body.position_id !== undefined) {
        const positionId = Number(body.position_id);
        await this.assertPosition(positionId, client);
        sets.push(`position_id = $${idx++}`);
        params.push(positionId);
      }
      if (body.active !== undefined) {
        sets.push(`active = $${idx++}`);
        params.push(Boolean(body.active));
      }
      if (body.password !== undefined) {
        const plain = String(body.password).trim();
        if (plain.length < 6) {
          throw new BadRequestException({ error: 'password_too_short' });
        }
        sets.push(`password_hash = $${idx++}`);
        params.push(hashPortalPassword(plain));
      }
      if (body.account_kind !== undefined) {
        sets.push(`account_kind = $${idx++}`);
        params.push(normalizeAccountKind(body.account_kind));
      }
      if (body.expires_at !== undefined) {
        sets.push(`expires_at = $${idx++}::timestamptz`);
        params.push(body.expires_at ? String(body.expires_at).trim() : null);
      }

      if (sets.length) {
        sets.push('updated_at = NOW()');
        params.push(userId);
        await client.query(
          `UPDATE staff_users SET ${sets.join(', ')} WHERE id = $${idx}::uuid`,
          params,
        );
      }

      if (body.team_ids !== undefined) {
        await this.replaceUserTeams(
          client,
          userId,
          (body.team_ids ?? []).map(Number).filter((n) => n > 0),
        );
      }

      if (body.active === false && existing.crm_staff_id) {
        await client.query(
          `UPDATE crm_staff SET active = FALSE, ended_on = CURRENT_DATE, updated_at = NOW()
           WHERE id = $1`,
          [existing.crm_staff_id],
        );
      }

      await this.writeAudit(client, {
        actor_email: actorEmail,
        entity_type: 'user',
        entity_id: userId,
        action: 'update',
        diff_json: body as Record<string, unknown>,
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.getUserById(userId);
    if (!updated) throw new NotFoundException({ error: 'user_not_found' });
    return updated;
  }

  async offboardUser(
    userId: string,
    body: OffboardStaffOrgUserBody,
    actorEmail: string,
  ): Promise<{ user: StaffOrgUserDetail; leads_reassigned: number }> {
    const existing = await this.getUserById(userId);
    if (!existing) throw new NotFoundException({ error: 'user_not_found', id: userId });

    const reassignTo = Number(body.reassign_to);
    if (!Number.isFinite(reassignTo) || reassignTo <= 0) {
      throw new BadRequestException({ error: 'invalid_reassign_to' });
    }

    const crmStaffId = existing.crm_staff_id;
    if (!crmStaffId) {
      throw new BadRequestException({ error: 'no_crm_staff_profile', message: 'User has no linked crm_staff row' });
    }
    if (reassignTo === crmStaffId) {
      throw new BadRequestException({ error: 'reassign_same_user' });
    }

    const targetHit = await this.db.query(
      `SELECT id FROM crm_staff WHERE id = $1 AND active IS TRUE LIMIT 1`,
      [reassignTo],
    );
    if (!targetHit.rows[0]) {
      throw new BadRequestException({ error: 'reassign_target_not_found' });
    }

    const client = await this.db.connect();
    let leadsReassigned = 0;
    try {
      await client.query('BEGIN');

      const leadUpdate = await client.query(
        `UPDATE crm_leads SET owner_id = $1, updated_at = NOW() WHERE owner_id = $2`,
        [reassignTo, crmStaffId],
      );
      leadsReassigned = leadUpdate.rowCount ?? 0;

      await client.query(
        `UPDATE crm_staff SET active = FALSE, ended_on = CURRENT_DATE, updated_at = NOW() WHERE id = $1`,
        [crmStaffId],
      );
      await client.query(
        `UPDATE staff_users SET active = FALSE, auth_token_version = auth_token_version + 1, updated_at = NOW() WHERE id = $1::uuid`,
        [userId],
      );

      await this.writeAudit(client, {
        actor_email: actorEmail,
        entity_type: 'user',
        entity_id: userId,
        action: 'offboard',
        diff_json: {
          crm_staff_id: crmStaffId,
          reassign_to: reassignTo,
          leads_reassigned: leadsReassigned,
          deactivate: body.deactivate !== false,
        },
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await this.getUserById(userId);
    if (!user) throw new NotFoundException({ error: 'user_not_found' });
    return { user, leads_reassigned: leadsReassigned };
  }
}

function normalizeAccountKind(raw?: string): 'staff' | 'guest' | 'contractor' {
  const v = String(raw ?? 'staff').trim().toLowerCase();
  if (v === 'guest' || v === 'contractor') return v;
  return 'staff';
}
