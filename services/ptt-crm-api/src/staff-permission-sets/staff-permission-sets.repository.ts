import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  capsToGrantMap,
  grantMapToCapRows,
  grantsToMatrix,
  normalizeGrantPayload,
} from '../staff-permissions/staff-permissions.catalog';
import type {
  CreateStaffPermissionSetBody,
  PatchStaffPermissionSetBody,
  PutStaffPermissionSetGrantsBody,
  StaffPermissionSetDetail,
  StaffPermissionSetSummary,
  StaffUserPermissionSetsResponse,
} from './staff-permission-sets.types';

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,62}$/i;

@Injectable()
export class StaffPermissionSetsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private memorySets = new Map<
    string,
    { id: number; code: string; name: string; active: boolean; grants: Record<string, string[]> }
  >();
  private memoryUserSets = new Map<string, string[]>();
  private nextId = 1;

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
  }

  private async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM staff_permission_sets LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private normalizeCode(code: string): string {
    const normalized = String(code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-');
    if (!normalized || !CODE_RE.test(normalized)) {
      throw new BadRequestException({ error: 'invalid_set_code', code });
    }
    return normalized;
  }

  async listSets(): Promise<StaffPermissionSetSummary[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query<{
        id: number;
        code: string;
        name: string;
        active: boolean;
        grant_count: string;
      }>(
        `SELECT s.id, s.code, s.name, s.active,
                COUNT(g.section_id)::int AS grant_count
         FROM staff_permission_sets s
         LEFT JOIN staff_permission_set_grants g ON g.set_id = s.id
         WHERE s.active IS TRUE
         GROUP BY s.id, s.code, s.name, s.active
         ORDER BY s.code`,
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        active: Boolean(row.active),
        grant_count: Number(row.grant_count ?? 0),
      }));
    }
    return [...this.memorySets.values()]
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        active: s.active,
        grant_count: Object.values(s.grants).reduce((n, acts) => n + acts.length, 0),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }

  async getSetByCode(code: string): Promise<StaffPermissionSetDetail | null> {
    const normalized = this.normalizeCode(code);
    if (await this.ensurePgReady()) {
      const meta = await this.db.query<{ id: number; code: string; name: string; active: boolean }>(
        `SELECT id, code, name, active FROM staff_permission_sets WHERE lower(code) = lower($1) LIMIT 1`,
        [normalized],
      );
      const row = meta.rows[0];
      if (!row) return null;
      const grantsResult = await this.db.query<{ section_id: string; action: string }>(
        `SELECT section_id, action FROM staff_permission_set_grants WHERE set_id = $1 ORDER BY section_id, action`,
        [row.id],
      );
      const grantMap = capsToGrantMap(
        grantsResult.rows.map((g) => ({
          section_id: String(g.section_id),
          action: String(g.action),
        })),
      );
      return {
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        active: Boolean(row.active),
        grants: grantsResult.rows.map((g) => ({
          section_id: String(g.section_id),
          action: String(g.action),
        })),
        matrix: grantsToMatrix(grantMap),
      };
    }
    const mem = this.memorySets.get(normalized);
    if (!mem) return null;
    return {
      id: mem.id,
      code: mem.code,
      name: mem.name,
      active: mem.active,
      grants: grantMapToCapRows(mem.grants).map((r) => ({
        section_id: r.section_id,
        action: r.action,
      })),
      matrix: grantsToMatrix(mem.grants),
    };
  }

  async createSet(body: CreateStaffPermissionSetBody): Promise<StaffPermissionSetDetail> {
    const code = this.normalizeCode(body.code);
    const name = String(body.name || code).trim().slice(0, 255);
    if (!name) throw new BadRequestException({ error: 'invalid_set_name' });

    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ id: number }>(
          `INSERT INTO staff_permission_sets (code, name, active)
           VALUES ($1, $2, TRUE)
           RETURNING id`,
          [code, name],
        );
        const id = Number(result.rows[0]?.id);
        return {
          id,
          code,
          name,
          active: true,
          grants: [],
          matrix: grantsToMatrix({}),
        };
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === '23505') {
          throw new ConflictException({ error: 'set_code_exists', code });
        }
        throw err;
      }
    }

    if (this.memorySets.has(code)) {
      throw new ConflictException({ error: 'set_code_exists', code });
    }
    const id = this.nextId++;
    this.memorySets.set(code, { id, code, name, active: true, grants: {} });
    return {
      id,
      code,
      name,
      active: true,
      grants: [],
      matrix: grantsToMatrix({}),
    };
  }

  async patchSet(code: string, body: PatchStaffPermissionSetBody): Promise<StaffPermissionSetDetail> {
    const existing = await this.getSetByCode(code);
    if (!existing) throw new NotFoundException({ error: 'set_not_found', code });

    const name = body.name != null ? String(body.name).trim().slice(0, 255) : existing.name;
    const active = body.active != null ? Boolean(body.active) : existing.active;

    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE staff_permission_sets SET name = $2, active = $3, updated_at = NOW() WHERE id = $1`,
        [existing.id, name, active],
      );
    } else {
      const mem = this.memorySets.get(existing.code);
      if (mem) {
        mem.name = name;
        mem.active = active;
      }
    }
    return (await this.getSetByCode(existing.code))!;
  }

  async replaceGrants(
    code: string,
    body: PutStaffPermissionSetGrantsBody,
  ): Promise<StaffPermissionSetDetail> {
    const existing = await this.getSetByCode(code);
    if (!existing) throw new NotFoundException({ error: 'set_not_found', code });

    const rawMap = capsToGrantMap(body.grants ?? []);
    const normalized = normalizeGrantPayload(rawMap);

    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_permission_set_grants WHERE set_id = $1`, [existing.id]);
        for (const row of grantMapToCapRows(normalized)) {
          await client.query(
            `INSERT INTO staff_permission_set_grants (set_id, section_id, action) VALUES ($1, $2, $3)`,
            [existing.id, row.section_id, row.action],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const mem = this.memorySets.get(existing.code);
      if (mem) mem.grants = normalized;
    }
    return (await this.getSetByCode(existing.code))!;
  }

  async loadCapsForSetCodes(codes: string[]): Promise<Array<{ section_id: string; action: string }>> {
    const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    const caps: Array<{ section_id: string; action: string }> = [];
    for (const code of normalized) {
      const set = await this.getSetByCode(code);
      if (!set?.active) continue;
      for (const grant of set.grants) {
        caps.push({ section_id: grant.section_id, action: grant.action });
      }
    }
    return caps;
  }

  async loadCapsForUser(userId: string): Promise<Array<{ section_id: string; action: string }>> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ section_id: string; action: string }>(
          `SELECT DISTINCT g.section_id, g.action
           FROM staff_user_permission_sets u
           JOIN staff_permission_set_grants g ON g.set_id = u.set_id
           JOIN staff_permission_sets s ON s.id = u.set_id AND s.active IS TRUE
           WHERE u.user_id = $1::uuid
           ORDER BY g.section_id, g.action`,
          [userId],
        );
        return result.rows.map((r) => ({
          section_id: String(r.section_id),
          action: String(r.action),
        }));
      } catch {
        return [];
      }
    }
    const codes = this.memoryUserSets.get(userId) ?? [];
    const caps: Array<{ section_id: string; action: string }> = [];
    for (const code of codes) {
      const set = this.memorySets.get(code.toUpperCase());
      if (!set?.active) continue;
      for (const [section_id, actions] of Object.entries(set.grants)) {
        for (const action of actions) {
          caps.push({ section_id, action });
        }
      }
    }
    return caps;
  }

  async loadUserSetCodes(userId: string): Promise<string[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ code: string }>(
          `SELECT s.code
           FROM staff_user_permission_sets u
           JOIN staff_permission_sets s ON s.id = u.set_id AND s.active IS TRUE
           WHERE u.user_id = $1::uuid
           ORDER BY s.code`,
          [userId],
        );
        return result.rows.map((r) => String(r.code));
      } catch {
        return [];
      }
    }
    return [...(this.memoryUserSets.get(userId) ?? [])].sort();
  }

  async replaceUserSets(
    userId: string,
    setCodes: string[],
    grantedBy = '',
  ): Promise<StaffUserPermissionSetsResponse> {
    const normalizedCodes = [...new Set(setCodes.map((c) => this.normalizeCode(c)))].sort();

    if (await this.ensurePgReady()) {
      const setIds: number[] = [];
      for (const code of normalizedCodes) {
        const set = await this.getSetByCode(code);
        if (!set) throw new NotFoundException({ error: 'set_not_found', code });
        setIds.push(set.id);
      }
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_user_permission_sets WHERE user_id = $1::uuid`, [userId]);
        for (const setId of setIds) {
          await client.query(
            `INSERT INTO staff_user_permission_sets (user_id, set_id, granted_by, granted_at)
             VALUES ($1::uuid, $2, $3, NOW())`,
            [userId, setId, grantedBy],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      for (const code of normalizedCodes) {
        if (!this.memorySets.has(code)) {
          throw new NotFoundException({ error: 'set_not_found', code });
        }
      }
      this.memoryUserSets.set(userId, normalizedCodes);
    }

    return { user_id: userId, set_codes: normalizedCodes };
  }
}
