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
import {
  DEFAULT_JOB_FUNCTION_GRANTS,
  JOB_FUNCTION_CATALOG,
  type JobFunctionDef,
} from './staff-job-functions.catalog';
import type { StaffPermissionCap, StaffPositionDetail } from './staff-permissions.types';

type FunctionSummary = JobFunctionDef & { grants_customized: boolean };

@Injectable()
export class StaffJobFunctionsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memoryGrants = structuredClone(DEFAULT_JOB_FUNCTION_GRANTS);
  private pgReady: boolean | null = null;

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
      await this.db.query(`SELECT 1 FROM staff_job_functions LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  listFunctions(): FunctionSummary[] {
    return JOB_FUNCTION_CATALOG.map((fn) => ({
      ...fn,
      grants_customized: false,
    }));
  }

  async getFunction(code: string): Promise<(FunctionSummary & { grants: Record<string, string[]>; matrix: ReturnType<typeof grantsToMatrix> }) | null> {
    const meta = JOB_FUNCTION_CATALOG.find((f) => f.code === code);
    if (!meta) return null;
    const grants = await this.loadGrants(code);
    const matrix = grantsToMatrix(grants);
    return {
      ...meta,
      grants_customized: await this.isCustomized(code),
      grants,
      matrix,
    };
  }

  private async isCustomized(code: string): Promise<boolean> {
    if (!(await this.ensurePgReady())) {
      const defaults = DEFAULT_JOB_FUNCTION_GRANTS[code] ?? {};
      const current = this.memoryGrants[code] ?? {};
      return JSON.stringify(defaults) !== JSON.stringify(current);
    }
    try {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM staff_job_function_grants WHERE function_code = $1`,
        [code],
      );
      return Number(result.rows[0]?.c ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async loadGrants(code: string): Promise<Record<string, string[]>> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ section_id: string; action: string }>(
          `SELECT section_id, action FROM staff_job_function_grants WHERE function_code = $1 ORDER BY section_id, action`,
          [code],
        );
        if (result.rowCount && result.rowCount > 0) {
          return capsToGrantMap(
            result.rows.map((row) => ({
              section_id: String(row.section_id),
              action: String(row.action),
            })),
          );
        }
      } catch {
        /* fall through */
      }
    }
    return structuredClone(this.memoryGrants[code] ?? DEFAULT_JOB_FUNCTION_GRANTS[code] ?? {});
  }

  async replaceGrants(
    code: string,
    grants: Record<string, string[]>,
    actorEmail: string,
  ): Promise<{ added: number; removed: number; diff: Record<string, unknown> }> {
    const meta = JOB_FUNCTION_CATALOG.find((f) => f.code === code);
    if (!meta) throw new NotFoundException({ error: 'function_not_found', code });

    const normalized = normalizeGrantPayload(grants);
    const before = await this.loadGrants(code);
    const diff = diffGrantMaps(before, normalized);

    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_job_function_grants WHERE function_code = $1`, [code]);
        const rows = grantMapToCapRows(normalized);
        for (const row of rows) {
          await client.query(
            `INSERT INTO staff_job_function_grants (function_code, section_id, action) VALUES ($1, $2, $3)`,
            [code, row.section_id, row.action],
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
      this.memoryGrants[code] = normalized;
    }

    return {
      added: Number(diff.added ?? 0),
      removed: Number(diff.removed ?? 0),
      diff,
    };
  }

  async loadCapsForFunctions(codes: string[]): Promise<StaffPermissionCap[]> {
    const caps: StaffPermissionCap[] = [];
    for (const code of codes) {
      const grants = await this.loadGrants(code);
      for (const [section_id, actions] of Object.entries(grants)) {
        for (const action of actions) {
          caps.push({ section_id, action });
        }
      }
    }
    return caps;
  }

  async loadUserFunctionCodes(userId: string): Promise<string[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ function_code: string }>(
          `SELECT function_code FROM staff_user_job_functions WHERE user_id = $1::uuid ORDER BY function_code`,
          [userId],
        );
        if (result.rowCount && result.rowCount > 0) {
          return result.rows.map((r) => String(r.function_code));
        }
      } catch {
        /* fall through */
      }
    }
    return [];
  }

  async replaceUserFunctions(
    userId: string,
    functionCodes: string[],
    assignedBy = '',
  ): Promise<string[]> {
    const normalized = [...new Set(functionCodes.map((c) => c.trim()).filter(Boolean))].sort();
    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_user_job_functions WHERE user_id = $1::uuid`, [userId]);
        for (const code of normalized) {
          await client.query(
            `INSERT INTO staff_user_job_functions (user_id, function_code, assigned_by, assigned_at)
             VALUES ($1::uuid, $2, $3, NOW())`,
            [userId, code, assignedBy],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    return normalized;
  }
}
