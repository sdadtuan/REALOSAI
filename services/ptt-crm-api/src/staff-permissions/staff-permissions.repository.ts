import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  capsToGrantMap,
  diffGrantMaps,
  grantMapToCapRows,
  grantsToMatrix,
  normalizeGrantPayload,
} from './staff-permissions.catalog';
import type {
  StaffPermissionAuditRow,
  StaffPermissionCap,
  StaffPositionDetail,
  StaffPositionSummary,
} from './staff-permissions.types';

@Injectable()
export class StaffPermissionsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

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

  async listPositions(): Promise<StaffPositionSummary[]> {
    const result = await this.db.query<{
      id: number;
      code: string;
      name: string;
      active: boolean;
      grants_customized: boolean;
    }>(
      `SELECT id, code, name, active, COALESCE(grants_customized, FALSE) AS grants_customized
       FROM crm_positions
       WHERE active = TRUE
       ORDER BY id`,
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      active: Boolean(row.active),
      grants_customized: Boolean(row.grants_customized),
    }));
  }

  async getPosition(positionId: number): Promise<StaffPositionSummary | null> {
    const result = await this.db.query<{
      id: number;
      code: string;
      name: string;
      active: boolean;
      grants_customized: boolean;
    }>(
      `SELECT id, code, name, active, COALESCE(grants_customized, FALSE) AS grants_customized
       FROM crm_positions
       WHERE id = $1
       LIMIT 1`,
      [positionId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      active: Boolean(row.active),
      grants_customized: Boolean(row.grants_customized),
    };
  }

  async loadCaps(positionId: number): Promise<StaffPermissionCap[]> {
    const result = await this.db.query<{ section_id: string; action: string }>(
      `SELECT section_id, action
       FROM staff_section_permissions
       WHERE position_id = $1
       ORDER BY section_id, action`,
      [positionId],
    );
    return result.rows.map((row) => ({
      section_id: String(row.section_id),
      action: String(row.action),
    }));
  }

  async replaceCaps(
    positionId: number,
    grants: Record<string, string[]>,
    actorEmail: string,
  ): Promise<{ added: number; removed: number; diff: Record<string, unknown> }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const positionResult = await client.query<{
        id: number;
        code: string;
        name: string;
      }>(`SELECT id, code, name FROM crm_positions WHERE id = $1 LIMIT 1`, [positionId]);
      const positionRow = positionResult.rows[0];
      if (!positionRow) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });
      const position = {
        id: Number(positionRow.id),
        code: String(positionRow.code ?? ''),
        name: String(positionRow.name ?? ''),
      };

      const beforeResult = await client.query<{ section_id: string; action: string }>(
        `SELECT section_id, action FROM staff_section_permissions WHERE position_id = $1`,
        [positionId],
      );
      const before = capsToGrantMap(
        beforeResult.rows.map((row) => ({
          section_id: String(row.section_id),
          action: String(row.action),
        })),
      );
      const after = normalizeGrantPayload(grants);
      const { added, removed } = diffGrantMaps(before, after);

      await client.query(`DELETE FROM staff_section_permissions WHERE position_id = $1`, [positionId]);
      const rows = grantMapToCapRows(after);
      for (const row of rows) {
        await client.query(
          `INSERT INTO staff_section_permissions (position_id, section_id, action)
           VALUES ($1, $2, $3)
           ON CONFLICT (position_id, section_id, action) DO NOTHING`,
          [positionId, row.section_id, row.action],
        );
      }

      await client.query(
        `UPDATE crm_positions SET grants_customized = TRUE, updated_at = NOW() WHERE id = $1`,
        [positionId],
      );

      const diffJson = {
        position_id: positionId,
        position_code: position.code,
        added,
        removed,
      };
      await client.query(
        `INSERT INTO staff_permission_audit (actor_email, position_id, diff_json)
         VALUES ($1, $2, $3::jsonb)`,
        [actorEmail || '', positionId, JSON.stringify(diffJson)],
      );

      await client.query('COMMIT');
      return { added: added.length, removed: removed.length, diff: diffJson };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listAudit(positionId?: number, limit = 50): Promise<StaffPermissionAuditRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const params: unknown[] = [];
    let where = '';
    if (positionId != null) {
      params.push(positionId);
      where = `WHERE a.position_id = $1`;
    }
    params.push(safeLimit);
    const limitParam = `$${params.length}`;
    const result = await this.db.query<{
      id: number;
      actor_email: string;
      position_id: number;
      position_code: string;
      diff_json: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT a.id, a.actor_email, a.position_id, COALESCE(p.code, '') AS position_code,
              a.diff_json, a.created_at
       FROM staff_permission_audit a
       LEFT JOIN crm_positions p ON p.id = a.position_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${limitParam}`,
      params,
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      actor_email: String(row.actor_email ?? ''),
      position_id: Number(row.position_id),
      position_code: String(row.position_code ?? ''),
      diff_json: row.diff_json ?? {},
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  }

  async buildPositionDetail(positionId: number): Promise<StaffPositionDetail | null> {
    const position = await this.getPosition(positionId);
    if (!position) return null;
    const caps = await this.loadCaps(positionId);
    const grants = capsToGrantMap(caps);
    return {
      ...position,
      grants,
      matrix: grantsToMatrix(grants),
    };
  }
}
