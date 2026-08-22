import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  InsertVdProjectInput,
  VdProjectRepository as VdProjectRepo,
  VdProjectRow,
  VdProjectStage,
  VdProjectStatus,
} from '../video-sop.types';

export type VdScriptRow = {
  id: number;
  project_id: number;
  version: number;
  markdown: string;
};

type MemoryStore = {
  projects: VdProjectRow[];
  briefs: Array<{ project_id: number; body_json: Record<string, unknown> }>;
  scripts: VdScriptRow[];
  audits: Array<{
    project_id: number;
    actor_email: string;
    action: string;
    payload_json: Record<string, unknown>;
  }>;
  nextId: number;
  nextScriptId: number;
};

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  return {};
}

const txClient = new AsyncLocalStorage<PoolClient>();

@Injectable()
export class VdProjectRepository implements VdProjectRepo, OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    projects: [],
    briefs: [],
    scripts: [],
    audits: [],
    nextId: 1,
    nextScriptId: 1,
  };

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private querier(): Pool | PoolClient {
    return txClient.getStore() ?? this.db;
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!(await this.ensurePgReady())) {
      return fn();
    }
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await txClient.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* keep original err (e.g. unique 23505) */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_projects LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private assertWritableOrThrow(): void {
    if (this.config.contentMarketingVideoCinematicEnabled) {
      throw new Error('vd_tables_missing');
    }
  }

  private mapRow(row: Record<string, unknown>): VdProjectRow {
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      client_id: row.client_id != null ? String(row.client_id) : null,
      cmkt_item_id: row.cmkt_item_id != null ? Number(row.cmkt_item_id) : null,
      title: String(row.title ?? ''),
      stage: String(row.stage ?? 'brief_draft') as VdProjectStage,
      status: String(row.status ?? 'active') as VdProjectStatus,
      created_by: String(row.created_by ?? ''),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async findByCmktItemId(itemId: number): Promise<VdProjectRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE cmkt_item_id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [itemId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.projects.find((p) => p.cmkt_item_id === itemId) ?? null;
  }

  async countCreatedToday(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c
         FROM vd_projects
         WHERE lifecycle_id = $1
           AND deleted_at IS NULL
           AND created_at >= date_trunc('day', NOW())
           AND created_at < date_trunc('day', NOW()) + interval '1 day'`,
        [lifecycleId],
      );
      return Number(res.rows[0]?.c ?? 0);
    }
    const start = startOfUtcDay().getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return this.memory.projects.filter((p) => {
      if (p.lifecycle_id !== lifecycleId) return false;
      const ts = Date.parse(p.created_at);
      return Number.isFinite(ts) && ts >= start && ts < end;
    }).length;
  }

  async insertProject(input: InsertVdProjectInput): Promise<VdProjectRow> {
    if (await this.ensurePgReady()) {
      const res = await this.querier().query(
        `INSERT INTO vd_projects (lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at`,
        [
          input.lifecycle_id,
          input.client_id,
          input.cmkt_item_id,
          input.title,
          input.stage,
          input.status,
          input.created_by,
        ],
      );
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    if (
      input.cmkt_item_id != null &&
      this.memory.projects.some((p) => p.cmkt_item_id === input.cmkt_item_id)
    ) {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    }
    const now = new Date().toISOString();
    const row: VdProjectRow = {
      id: this.memory.nextId++,
      lifecycle_id: input.lifecycle_id,
      client_id: input.client_id,
      cmkt_item_id: input.cmkt_item_id,
      title: input.title,
      stage: input.stage,
      status: input.status,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.memory.projects.push(row);
    return row;
  }

  async insertBrief(projectId: number, bodyJson: Record<string, unknown>): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.querier().query(`INSERT INTO vd_briefs (project_id, body_json) VALUES ($1, $2::jsonb)`, [
        projectId,
        JSON.stringify(bodyJson),
      ]);
      return;
    }
    this.assertWritableOrThrow();
    this.memory.briefs.push({ project_id: projectId, body_json: bodyJson });
  }

  async getBrief(projectId: number): Promise<Record<string, unknown> | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(`SELECT body_json FROM vd_briefs WHERE project_id = $1`, [projectId]);
      const row = res.rows[0] as { body_json?: unknown } | undefined;
      if (!row) return null;
      return asJsonObject(row.body_json);
    }
    return this.memory.briefs.find((b) => b.project_id === projectId)?.body_json ?? null;
  }

  async upsertBrief(projectId: number, bodyJson: Record<string, unknown>): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.querier().query(
        `INSERT INTO vd_briefs (project_id, body_json) VALUES ($1, $2::jsonb)
         ON CONFLICT (project_id) DO UPDATE SET body_json = EXCLUDED.body_json, updated_at = now()`,
        [projectId, JSON.stringify(bodyJson)],
      );
      return;
    }
    this.assertWritableOrThrow();
    const existing = this.memory.briefs.find((b) => b.project_id === projectId);
    if (existing) {
      existing.body_json = bodyJson;
      return;
    }
    this.memory.briefs.push({ project_id: projectId, body_json: bodyJson });
  }

  async updateStage(projectId: number, stage: VdProjectStage): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.querier().query(
        `UPDATE vd_projects SET stage = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        [projectId, stage],
      );
      return;
    }
    this.assertWritableOrThrow();
    const row = this.memory.projects.find((p) => p.id === projectId);
    if (row) {
      row.stage = stage;
      row.updated_at = new Date().toISOString();
    }
  }

  async listApprovedInsights(): Promise<Array<{ id: number; title: string }>> {
    try {
      const res = await this.db.query(
        `SELECT i.id, left(i.statement, 120) AS title FROM crm_research_insights i WHERE i.status IN ('approved_internal','approved_client_facing','published') ORDER BY i.id DESC LIMIT 50`,
      );
      return (res.rows as Array<{ id: unknown; title: unknown }>).map((row) => ({
        id: Number(row.id),
        title: String(row.title ?? ''),
      }));
    } catch {
      return [];
    }
  }

  private mapScriptRow(row: Record<string, unknown>): VdScriptRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      version: Number(row.version),
      markdown: String(row.markdown ?? ''),
    };
  }

  async listScripts(projectId: number): Promise<VdScriptRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, version, markdown FROM vd_scripts WHERE project_id = $1 ORDER BY version ASC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapScriptRow(row));
    }
    return this.memory.scripts
      .filter((row) => row.project_id === projectId)
      .slice()
      .sort((a, b) => a.version - b.version);
  }

  async getScriptById(id: number): Promise<VdScriptRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, version, markdown FROM vd_scripts WHERE id = $1`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapScriptRow(row) : null;
    }
    return this.memory.scripts.find((row) => row.id === id) ?? null;
  }

  async insertScript(projectId: number, version: number, markdown: string): Promise<void> {
    await this.insertScriptRow(projectId, version, markdown);
  }

  async insertScriptRow(projectId: number, version: number, markdown: string): Promise<VdScriptRow> {
    if (await this.ensurePgReady()) {
      const res = await this.querier().query(
        `INSERT INTO vd_scripts (project_id, version, markdown)
         VALUES ($1, $2, $3)
         RETURNING id, project_id, version, markdown`,
        [projectId, version, markdown],
      );
      return this.mapScriptRow(res.rows[0] as Record<string, unknown>);
    }
    this.assertWritableOrThrow();
    const row: VdScriptRow = {
      id: this.memory.nextScriptId++,
      project_id: projectId,
      version,
      markdown,
    };
    this.memory.scripts.push(row);
    return row;
  }

  async updateScriptMarkdown(id: number, markdown: string): Promise<VdScriptRow> {
    if (await this.ensurePgReady()) {
      const res = await this.querier().query(
        `UPDATE vd_scripts SET markdown = $2 WHERE id = $1
         RETURNING id, project_id, version, markdown`,
        [id, markdown],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('vd_script_not_found');
      return this.mapScriptRow(row);
    }
    this.assertWritableOrThrow();
    const row = this.memory.scripts.find((s) => s.id === id);
    if (!row) throw new Error('vd_script_not_found');
    row.markdown = markdown;
    return { ...row };
  }

  async insertAudit(
    projectId: number,
    actorEmail: string,
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.querier().query(
        `INSERT INTO vd_audit_logs (project_id, actor_email, action, payload_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [projectId, actorEmail, action, JSON.stringify(payload)],
      );
      return;
    }
    this.assertWritableOrThrow();
    this.memory.audits.push({
      project_id: projectId,
      actor_email: actorEmail,
      action,
      payload_json: payload,
    });
  }

  async listByLifecycle(lifecycleId: number): Promise<VdProjectRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE lifecycle_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [lifecycleId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.projects
      .filter((p) => p.lifecycle_id === lifecycleId)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getById(id: number): Promise<VdProjectRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, client_id, cmkt_item_id, title, stage, status, created_by, created_at, updated_at
         FROM vd_projects
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.projects.find((p) => p.id === id) ?? null;
  }
}
