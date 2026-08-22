import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { AssignScopeRowLite } from './lead-assign-scope.util';

export interface IngestStaffRow {
  id: number;
  name: string;
  active: boolean;
  sales_level?: string;
}

export interface IngestRulesSnapshot {
  lead_config: Record<string, unknown>;
  staff_rows: IngestStaffRow[];
  assignment_state: Array<{ pool_key: string; last_staff_id: number }>;
  staff_assign_scope: AssignScopeRowLite[];
}

@Injectable()
export class LeadIngestRulesRepository implements OnModuleDestroy {
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

  async snapshotReady(): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'crm_ingest_rules_snapshot'
       LIMIT 1`,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async fetchSnapshot(): Promise<IngestRulesSnapshot | null> {
    if (!(await this.snapshotReady())) return null;
    const result = await this.db.query(
      `SELECT lead_config, staff_rows, assignment_state, staff_assign_scope
       FROM crm_ingest_rules_snapshot
       WHERE id = 1`,
    );
    const row = result.rows[0];
    if (!row) return null;

    const staffRowsRaw = row.staff_rows;
    const assignStateRaw = row.assignment_state;
    const scopesRaw = row.staff_assign_scope;

    const staffRows = Array.isArray(staffRowsRaw) ? (staffRowsRaw as unknown[]) : [];
    const assignState = Array.isArray(assignStateRaw) ? (assignStateRaw as unknown[]) : [];
    const scopes = Array.isArray(scopesRaw) ? (scopesRaw as unknown[]) : [];

    return {
      lead_config: (row.lead_config as Record<string, unknown>) ?? {},
      staff_rows: staffRows
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          id: Number(item.id),
          name: String(item.name ?? ''),
          active: item.active === false || item.active === 0 ? false : true,
          sales_level: item.sales_level != null ? String(item.sales_level) : undefined,
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0),
      assignment_state: assignState
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          pool_key: String(item.pool_key ?? ''),
          last_staff_id: Number(item.last_staff_id ?? 0),
        }))
        .filter((item) => item.pool_key),
      staff_assign_scope: scopes
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          staff_id: Number(item.staff_id),
          industry_slug: String(item.industry_slug ?? '*'),
          service_slug: String(item.service_slug ?? '*'),
          active: item.active === false || item.active === 0 ? false : true,
        }))
        .filter((item) => Number.isFinite(item.staff_id) && item.staff_id > 0),
    };
  }

  async fetchClientIndustry(clientId: string): Promise<string | null> {
    const id = clientId.trim();
    if (!id) return null;
    const result = await this.db.query(
      `SELECT industry_slug FROM clients WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    const slug = result.rows[0]?.industry_slug;
    return slug != null ? String(slug) : null;
  }

  async listActiveStaff(limit = 500): Promise<IngestStaffRow[]> {
    const snap = await this.fetchSnapshot();
    if (!snap) return [];
    const lim = Math.max(1, Math.min(limit, 1000));
    return snap.staff_rows.filter((row) => row.active).slice(0, lim);
  }

  async staffExists(staffId: number): Promise<boolean> {
    if (!Number.isFinite(staffId) || staffId <= 0) return false;
    const snap = await this.fetchSnapshot();
    if (!snap) return false;
    return snap.staff_rows.some((row) => row.id === staffId && row.active);
  }

  async staffName(staffId: number): Promise<string> {
    if (!Number.isFinite(staffId) || staffId <= 0) return '';
    const snap = await this.fetchSnapshot();
    const row = snap?.staff_rows.find((item) => item.id === staffId);
    return row?.name?.trim() || `#${staffId}`;
  }

  async syncStaffRowsFromRoster(): Promise<void> {
    if (!(await this.snapshotReady())) return;

    const staffTable = await this.db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'crm_staff'
       LIMIT 1`,
    );
    if ((staffTable.rowCount ?? 0) === 0) return;

    const result = await this.db.query(
      `SELECT id, name, notes, active, job_title, internal_code
       FROM crm_staff
       WHERE active = TRUE
       ORDER BY sort_order ASC, lower(name) ASC, id ASC`,
    );

    const staffRows = (result.rows as Array<Record<string, unknown>>).map((row) => {
      const jobTitle = String(row.job_title ?? '').trim();
      return {
        id: Number(row.id),
        name: String(row.name ?? ''),
        notes: String(row.notes ?? ''),
        active: row.active !== false && row.active !== 0,
        sales_level: jobTitle || 'b',
        internal_code: String(row.internal_code ?? ''),
      };
    });

    await this.db.query(
      `UPDATE crm_ingest_rules_snapshot
       SET staff_rows = $1::jsonb, synced_at = NOW()
       WHERE id = 1`,
      [JSON.stringify(staffRows)],
    );
  }

  async persistAssignmentState(poolKey: string, lastStaffId: number): Promise<void> {
    if (!(await this.snapshotReady())) return;
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT assignment_state FROM crm_ingest_rules_snapshot WHERE id = 1 FOR UPDATE`,
      );
      const current = locked.rows[0]?.assignment_state;
      const rows = Array.isArray(current) ? ([...current] as unknown[]) : [];
      const idx = rows.findIndex((item) => {
        if (!item || typeof item !== 'object') return false;
        return String((item as Record<string, unknown>).pool_key ?? '') === poolKey;
      });
      const nextRow = { pool_key: poolKey, last_staff_id: lastStaffId };
      if (idx >= 0) rows[idx] = nextRow;
      else rows.push(nextRow);
      await client.query(
        `UPDATE crm_ingest_rules_snapshot
         SET assignment_state = $1::jsonb, synced_at = NOW()
         WHERE id = 1`,
        [JSON.stringify(rows)],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
