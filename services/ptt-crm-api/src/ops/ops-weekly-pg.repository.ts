import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { OpsWeeklyTemplateTask } from './ops-weekly-template.util';

export type OpsWeeklyChecklistItem = {
  id: number;
  lifecycle_id: number;
  iso_week: string;
  template_task_id: string;
  title: string;
  owner_role: string;
  day_of_week: number | null;
  status: 'pending' | 'done' | 'skipped';
  kpi_key: string | null;
  completed_at: string | null;
  created_at: string;
};

export type OpsWeeklySpawnLog = {
  id: number;
  lifecycle_id: number;
  iso_week: string;
  dv_code: string;
  tasks_created: number;
  spawned_at: string;
  spawned_by: string;
};

@Injectable()
export class OpsWeeklyPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      if (!this.config.databaseUrl) {
        throw new Error('ops_weekly_pg_requires_database_url');
      }
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  canUsePg(): boolean {
    return Boolean(this.config.databaseUrl?.trim());
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.canUsePg()) return;
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ops_weekly_spawn_log (
        id SERIAL PRIMARY KEY,
        lifecycle_id INT NOT NULL,
        iso_week VARCHAR(10) NOT NULL,
        dv_code VARCHAR(8) NOT NULL,
        tasks_created INT NOT NULL DEFAULT 0,
        spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        spawned_by VARCHAR(80) NOT NULL DEFAULT 'system',
        UNIQUE (lifecycle_id, iso_week)
      );

      CREATE INDEX IF NOT EXISTS idx_ops_weekly_spawn_lifecycle
        ON ops_weekly_spawn_log (lifecycle_id);

      CREATE TABLE IF NOT EXISTS ops_weekly_checklist_item (
        id SERIAL PRIMARY KEY,
        lifecycle_id INT NOT NULL,
        iso_week VARCHAR(10) NOT NULL,
        template_task_id VARCHAR(80) NOT NULL,
        title VARCHAR(500) NOT NULL,
        owner_role VARCHAR(80) NOT NULL DEFAULT '',
        day_of_week SMALLINT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'done', 'skipped')),
        kpi_key VARCHAR(80) NULL,
        completed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (lifecycle_id, iso_week, template_task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ops_weekly_checklist_lifecycle_week
        ON ops_weekly_checklist_item (lifecycle_id, iso_week);
    `);
  }

  async getSpawnLog(lifecycleId: number, isoWeek: string): Promise<OpsWeeklySpawnLog | null> {
    if (!this.canUsePg()) return null;
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT * FROM ops_weekly_spawn_log WHERE lifecycle_id = $1 AND iso_week = $2 LIMIT 1`,
      [lifecycleId, isoWeek],
    );
    const row = res.rows[0];
    return row ? this.mapSpawnLog(row as Record<string, unknown>) : null;
  }

  async listChecklistItems(lifecycleId: number, isoWeek: string): Promise<OpsWeeklyChecklistItem[]> {
    if (!this.canUsePg()) return [];
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT * FROM ops_weekly_checklist_item
       WHERE lifecycle_id = $1 AND iso_week = $2
       ORDER BY COALESCE(day_of_week, 8), id ASC`,
      [lifecycleId, isoWeek],
    );
    return res.rows.map((row) => this.mapChecklistItem(row as Record<string, unknown>));
  }

  async countChecklistSummary(
    lifecycleId: number,
    isoWeek: string,
  ): Promise<{ pending: number; done: number; spawned: boolean }> {
    if (!this.canUsePg()) return { pending: 0, done: 0, spawned: false };
    await this.ensureSchema();
    const [spawn, counts] = await Promise.all([
      this.getSpawnLog(lifecycleId, isoWeek),
      this.db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'done')::int AS done
         FROM ops_weekly_checklist_item
         WHERE lifecycle_id = $1 AND iso_week = $2`,
        [lifecycleId, isoWeek],
      ),
    ]);
    return {
      pending: Number(counts.rows[0]?.pending ?? 0),
      done: Number(counts.rows[0]?.done ?? 0),
      spawned: Boolean(spawn),
    };
  }

  async countDistinctSpawnWeeks(lifecycleId: number): Promise<number> {
    if (!this.canUsePg()) return 0;
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM ops_weekly_spawn_log WHERE lifecycle_id = $1`,
      [lifecycleId],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async spawnWeek(input: {
    lifecycleId: number;
    isoWeek: string;
    dvCode: string;
    tasks: OpsWeeklyTemplateTask[];
    spawnedBy: string;
    phaseCode?: string;
    skuCode?: string;
  }): Promise<{ created: number; already_spawned: boolean; items: OpsWeeklyChecklistItem[] }> {
    if (!this.canUsePg()) {
      throw new Error('ops_weekly_pg_unavailable');
    }
    await this.ensureSchema();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT id FROM ops_weekly_spawn_log WHERE lifecycle_id = $1 AND iso_week = $2 LIMIT 1`,
        [input.lifecycleId, input.isoWeek],
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        const items = await this.listChecklistItems(input.lifecycleId, input.isoWeek);
        return { created: 0, already_spawned: true, items };
      }

      let created = 0;
      for (const task of input.tasks) {
        const res = await client.query(
          `INSERT INTO ops_weekly_checklist_item
             (lifecycle_id, iso_week, template_task_id, title, owner_role, day_of_week, kpi_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (lifecycle_id, iso_week, template_task_id) DO NOTHING
           RETURNING id`,
          [
            input.lifecycleId,
            input.isoWeek,
            task.id,
            task.title,
            task.owner_role ?? 'TeamLead',
            task.day_of_week ?? null,
            task.kpi_key ?? null,
          ],
        );
        if (res.rows[0]) created += 1;
      }

      await client.query(
        `INSERT INTO ops_weekly_spawn_log
           (lifecycle_id, iso_week, dv_code, tasks_created, spawned_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [input.lifecycleId, input.isoWeek, input.dvCode, created, input.spawnedBy],
      );
      await client.query('COMMIT');
      const items = await this.listChecklistItems(input.lifecycleId, input.isoWeek);
      return { created, already_spawned: false, items };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateChecklistItemStatus(
    lifecycleId: number,
    itemId: number,
    status: 'pending' | 'done' | 'skipped',
  ): Promise<OpsWeeklyChecklistItem | null> {
    if (!this.canUsePg()) return null;
    await this.ensureSchema();
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    const res = await this.db.query(
      `UPDATE ops_weekly_checklist_item
       SET status = $3,
           completed_at = CASE WHEN $3 = 'done' THEN NOW() ELSE NULL END
       WHERE lifecycle_id = $1 AND id = $2
       RETURNING *`,
      [lifecycleId, itemId, status],
    );
    const row = res.rows[0];
    return row ? this.mapChecklistItem(row as Record<string, unknown>) : null;
  }

  private mapSpawnLog(row: Record<string, unknown>): OpsWeeklySpawnLog {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      iso_week: String(row.iso_week ?? ''),
      dv_code: String(row.dv_code ?? ''),
      tasks_created: Number(row.tasks_created ?? 0),
      spawned_at: row.spawned_at instanceof Date ? row.spawned_at.toISOString() : String(row.spawned_at ?? ''),
      spawned_by: String(row.spawned_by ?? 'system'),
    };
  }

  private mapChecklistItem(row: Record<string, unknown>): OpsWeeklyChecklistItem {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      iso_week: String(row.iso_week ?? ''),
      template_task_id: String(row.template_task_id ?? ''),
      title: String(row.title ?? ''),
      owner_role: String(row.owner_role ?? ''),
      day_of_week: row.day_of_week != null ? Number(row.day_of_week) : null,
      status: String(row.status ?? 'pending') as OpsWeeklyChecklistItem['status'],
      kpi_key: row.kpi_key != null ? String(row.kpi_key) : null,
      completed_at:
        row.completed_at instanceof Date
          ? row.completed_at.toISOString()
          : row.completed_at != null
            ? String(row.completed_at)
            : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    };
  }
}
