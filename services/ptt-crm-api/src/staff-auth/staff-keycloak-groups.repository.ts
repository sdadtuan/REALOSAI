import { Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export interface StaffKeycloakGroupMapRow {
  kc_group: string;
  position_id: number;
  position_code?: string;
  position_name?: string;
  default_set_codes: string[];
  active: boolean;
  updated_at: string;
  updated_by: string;
}

export interface PutStaffKeycloakGroupMapBody {
  position_id: number;
  default_set_codes?: string[];
  active?: boolean;
}

@Injectable()
export class StaffKeycloakGroupsRepository {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async listAll(): Promise<StaffKeycloakGroupMapRow[]> {
    try {
      const result = await this.db.query(
        `SELECT m.kc_group, m.position_id, m.default_set_codes, m.active,
                m.updated_at::text, m.updated_by,
                p.code AS position_code, p.name AS position_name
         FROM staff_keycloak_group_map m
         JOIN crm_positions p ON p.id = m.position_id
         ORDER BY m.kc_group`,
      );
      return result.rows.map((row) => this.mapRow(row));
    } catch {
      return [];
    }
  }

  async findByGroup(kcGroup: string): Promise<StaffKeycloakGroupMapRow | null> {
    const normalized = String(kcGroup).trim().replace(/^\//, '');
    if (!normalized) return null;
    try {
      const result = await this.db.query(
        `SELECT m.kc_group, m.position_id, m.default_set_codes, m.active,
                m.updated_at::text, m.updated_by,
                p.code AS position_code, p.name AS position_name
         FROM staff_keycloak_group_map m
         JOIN crm_positions p ON p.id = m.position_id
         WHERE m.kc_group = $1 AND m.active IS TRUE
         LIMIT 1`,
        [normalized],
      );
      const row = result.rows[0];
      return row ? this.mapRow(row) : null;
    } catch {
      return null;
    }
  }

  async resolvePositionFromGroups(
    groups: string[],
  ): Promise<{ positionId: number; setCodes: string[] } | null> {
    for (const group of groups) {
      const map = await this.findByGroup(group);
      if (map) {
        return {
          positionId: map.position_id,
          setCodes: map.default_set_codes ?? [],
        };
      }
    }
    return null;
  }

  async upsert(
    kcGroup: string,
    body: PutStaffKeycloakGroupMapBody,
    actorEmail: string,
  ): Promise<StaffKeycloakGroupMapRow> {
    const group = String(kcGroup).trim().replace(/^\//, '');
    if (!group) {
      throw new NotFoundException({ error: 'invalid_kc_group' });
    }
    const positionId = Number(body.position_id);
    if (!Number.isFinite(positionId) || positionId <= 0) {
      throw new NotFoundException({ error: 'invalid_position_id' });
    }

    const posHit = await this.db.query(`SELECT id FROM crm_positions WHERE id = $1 LIMIT 1`, [
      positionId,
    ]);
    if (!posHit.rows[0]) {
      throw new NotFoundException({ error: 'position_not_found' });
    }

    const setCodes = Array.isArray(body.default_set_codes) ? body.default_set_codes : [];
    const active = body.active !== false;

    await this.db.query(
      `INSERT INTO staff_keycloak_group_map (kc_group, position_id, default_set_codes, active, updated_by)
       VALUES ($1, $2, $3::text[], $4, $5)
       ON CONFLICT (kc_group) DO UPDATE SET
         position_id = EXCLUDED.position_id,
         default_set_codes = EXCLUDED.default_set_codes,
         active = EXCLUDED.active,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [group, positionId, setCodes, active, actorEmail.trim() || 'system'],
    );

    const saved = await this.findByGroup(group);
    if (!saved) {
      throw new NotFoundException({ error: 'group_map_save_failed' });
    }
    return saved;
  }

  private mapRow(row: Record<string, unknown>): StaffKeycloakGroupMapRow {
    return {
      kc_group: String(row.kc_group),
      position_id: Number(row.position_id),
      position_code: row.position_code ? String(row.position_code) : undefined,
      position_name: row.position_name ? String(row.position_name) : undefined,
      default_set_codes: Array.isArray(row.default_set_codes)
        ? row.default_set_codes.map(String)
        : [],
      active: row.active !== false,
      updated_at: String(row.updated_at ?? ''),
      updated_by: String(row.updated_by ?? ''),
    };
  }
}
