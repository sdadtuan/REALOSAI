import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  addDaysIso,
  CreateSopRunBody,
  CRM_SOP_RUN_STATUSES,
  isValidDateYmd,
  normalizeSopRunStatus,
  SopOverdueTaskRow,
  SopRunRow,
  SopRunStats,
  SopRunTaskRow,
  SopStepRow,
  SopTemplateRow,
} from './sop.types';

const RUN_SELECT = `
SELECT r.*, t.name AS template_name, t.channel AS template_channel,
       c.name AS campaign_name, c.code AS campaign_code
FROM crm_sop_runs r
LEFT JOIN crm_sop_templates t ON t.id = r.template_id
LEFT JOIN hub_campaigns c ON c.id = r.campaign_id
`;

@Injectable()
export class SopPgRepository implements OnModuleDestroy {
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

  async listTemplates(includeInactive: boolean): Promise<SopTemplateRow[]> {
    const sql = includeInactive
      ? `SELECT * FROM crm_sop_templates
         ORDER BY active DESC, lower(name) ASC`
      : `SELECT * FROM crm_sop_templates
         WHERE active = TRUE
         ORDER BY lower(name) ASC`;
    const result = await this.db.query(sql);
    return (result.rows as Array<Record<string, unknown>>).map((r) => this.mapTemplateRow(r));
  }

  async getTemplateById(id: number): Promise<SopTemplateRow | null> {
    const result = await this.db.query('SELECT * FROM crm_sop_templates WHERE id = $1', [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTemplateRow(row) : null;
  }

  async getTemplateByCode(code: string): Promise<SopTemplateRow | null> {
    const result = await this.db.query(
      `SELECT * FROM crm_sop_templates
       WHERE code = $1 AND active = TRUE
       ORDER BY id DESC LIMIT 1`,
      [code],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTemplateRow(row) : null;
  }

  async listSteps(templateId: number): Promise<SopStepRow[]> {
    const result = await this.db.query(
      `SELECT * FROM crm_sop_steps
       WHERE template_id = $1
       ORDER BY position ASC, id ASC`,
      [templateId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((r) => this.mapStepRow(r));
  }

  async listRuns(statusFilter: string): Promise<SopRunRow[]> {
    let result;
    if (statusFilter === 'all') {
      result = await this.db.query(
        `${RUN_SELECT}
         ORDER BY r.updated_at DESC, r.id DESC
         LIMIT 300`,
      );
    } else {
      result = await this.db.query(
        `${RUN_SELECT}
         WHERE r.status = $1
         ORDER BY r.start_date ASC NULLS LAST, r.id ASC
         LIMIT 300`,
        [statusFilter],
      );
    }
    const rows = result.rows as Array<Record<string, unknown>>;
    return Promise.all(rows.map((r) => this.mapRunRow(r)));
  }

  async createRun(body: CreateSopRunBody, generateTasks = true): Promise<SopRunRow> {
    const name = String(body.name ?? '').trim().slice(0, 400);
    const startDate = String(body.start_date ?? '').trim().slice(0, 32);
    const notes = String(body.notes ?? '').trim().slice(0, 8000);
    const status = normalizeSopRunStatus(body.status);

    let campaignId: number | null = null;
    if (body.campaign_id != null && body.campaign_id !== 0) {
      const cid = Number(body.campaign_id);
      if (Number.isFinite(cid) && cid > 0) campaignId = cid;
    }
    let templateId: number | null = null;
    if (body.template_id != null && body.template_id !== 0) {
      const tid = Number(body.template_id);
      if (Number.isFinite(tid) && tid > 0) templateId = tid;
    }

    const ts = catalogTs();

    const insertResult = await this.db.query(
      `INSERT INTO crm_sop_runs
         (campaign_id, template_id, name, status, start_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NULLIF($5, '')::date, $6, $7::timestamptz, $7::timestamptz)
       RETURNING id`,
      [campaignId, templateId, name, status, startDate, notes, ts],
    );
    const runId = Number(insertResult.rows[0]?.id ?? 0);

    if (templateId && generateTasks) {
      await this.generateTasks(runId, templateId, startDate);
    }

    const run = await this.getRunById(runId);
    if (!run) throw new Error('Failed to create SOP run');
    return run;
  }

  async getRunById(runId: number): Promise<SopRunRow | null> {
    const result = await this.db.query(`${RUN_SELECT} WHERE r.id = $1`, [runId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRunRow(row) : null;
  }

  async listRunTasks(runId: number): Promise<SopRunTaskRow[]> {
    const result = await this.db.query(
      `SELECT id, run_id, step_id, position, title, description, role,
              due_date, status, notes, checklist_json, created_at, updated_at
       FROM crm_sop_run_tasks
       WHERE run_id = $1
       ORDER BY position ASC, id ASC`,
      [runId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      run_id: Number(row.run_id),
      step_id: row.step_id != null ? Number(row.step_id) : null,
      position: Number(row.position ?? 0),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      role: String(row.role ?? ''),
      due_date: this.dateStr(row.due_date),
      status: String(row.status ?? 'todo'),
      notes: String(row.notes ?? ''),
      checklist_json: this.jsonStr(row.checklist_json),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    }));
  }

  async listOverdueTasks(limit = 100): Promise<SopOverdueTaskRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const result = await this.db.query(
      `SELECT t.id, t.run_id, t.step_id, t.position, t.title, t.description, t.role,
              t.due_date, t.status, t.notes, t.checklist_json, t.created_at, t.updated_at,
              r.name AS run_name, r.status AS run_status, lc.id AS lifecycle_id
       FROM crm_sop_run_tasks t
       INNER JOIN crm_sop_runs r ON r.id = t.run_id
       LEFT JOIN crm_service_lifecycle lc ON lc.sop_run_id = r.id
       WHERE t.status NOT IN ('done', 'skipped')
         AND t.due_date IS NOT NULL AND t.due_date < $1::date
       ORDER BY t.due_date ASC, t.run_id ASC, t.position ASC
       LIMIT $2`,
      [today, cap],
    );
    const todayMs = new Date(`${today}T00:00:00Z`).getTime();
    return (result.rows as Array<Record<string, unknown>>).map((row) => {
      const due = this.dateStr(row.due_date);
      const dueMs = due ? new Date(`${due}T00:00:00Z`).getTime() : 0;
      const daysOverdue =
        dueMs && Number.isFinite(dueMs) ? Math.max(0, Math.floor((todayMs - dueMs) / 86400000)) : 0;
      return {
        id: Number(row.id),
        run_id: Number(row.run_id),
        step_id: row.step_id != null ? Number(row.step_id) : null,
        position: Number(row.position ?? 0),
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        role: String(row.role ?? ''),
        due_date: due,
        status: String(row.status ?? 'todo'),
        notes: String(row.notes ?? ''),
        checklist_json: this.jsonStr(row.checklist_json),
        created_at: String(row.created_at ?? ''),
        updated_at: String(row.updated_at ?? ''),
        run_name: String(row.run_name ?? ''),
        run_status: String(row.run_status ?? ''),
        lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
        days_overdue: daysOverdue,
      };
    });
  }

  async campaignExists(campaignId: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM hub_campaigns WHERE id = $1 LIMIT 1',
      [campaignId],
    );
    return !!result.rows[0];
  }

  isValidRunStatus(status: string): boolean {
    return (CRM_SOP_RUN_STATUSES as readonly string[]).includes(status);
  }

  private async generateTasks(runId: number, templateId: number, startDate: string): Promise<void> {
    const steps = await this.listSteps(templateId);
    const ts = catalogTs();

    for (const step of steps) {
      let due: string | null = null;
      if (startDate && isValidDateYmd(startDate)) {
        due = addDaysIso(startDate, step.offset_days) || null;
      }
      await this.db.query(
        `INSERT INTO crm_sop_run_tasks (
           run_id, step_id, position, title, description,
           role, due_date, status, checklist_json, notes, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'todo', $8::jsonb, '', $9::timestamptz, $9::timestamptz)`,
        [
          runId,
          step.id,
          step.position,
          step.title,
          step.description,
          step.role,
          due,
          step.checklist_json,
          ts,
        ],
      );
    }
  }

  private async runStats(runId: number): Promise<SopRunStats> {
    const result = await this.db.query(
      'SELECT status FROM crm_sop_run_tasks WHERE run_id = $1',
      [runId],
    );
    const rows = result.rows as Array<{ status: string }>;
    const total = rows.length;
    let done = 0;
    let skipped = 0;
    let inProgress = 0;
    for (const r of rows) {
      if (r.status === 'done') done += 1;
      else if (r.status === 'skipped') skipped += 1;
      else if (r.status === 'in_progress') inProgress += 1;
    }
    const today = new Date().toISOString().slice(0, 10);
    const overdueResult = await this.db.query(
      `SELECT count(*)::int AS cnt FROM crm_sop_run_tasks
       WHERE run_id = $1 AND status NOT IN ('done','skipped')
         AND due_date IS NOT NULL AND due_date < $2::date`,
      [runId, today],
    );
    return {
      total,
      done,
      skipped,
      in_progress: inProgress,
      todo: total - done - skipped - inProgress,
      overdue: Number(overdueResult.rows[0]?.cnt ?? 0),
    };
  }

  private dateStr(raw: unknown): string {
    if (raw == null) return '';
    return String(raw).slice(0, 10);
  }

  private jsonStr(raw: unknown): string {
    if (raw == null) return '[]';
    if (typeof raw === 'string') return raw || '[]';
    return JSON.stringify(raw);
  }

  private mapTemplateRow(row: Record<string, unknown>): SopTemplateRow {
    return {
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      channel: String(row.channel ?? ''),
      description: String(row.description ?? ''),
      notes: String(row.notes ?? ''),
      active: row.active === true || row.active === 1 ? 1 : 0,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapStepRow(row: Record<string, unknown>): SopStepRow {
    return {
      id: Number(row.id),
      template_id: Number(row.template_id),
      position: Number(row.position ?? 0),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      offset_days: Number(row.offset_days ?? 0),
      duration_days: Number(row.duration_days ?? 1),
      role: String(row.role ?? ''),
      required: row.required === true || row.required === 1 ? 1 : 0,
      checklist_json: this.jsonStr(row.checklist_json),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private async mapRunRow(row: Record<string, unknown>): Promise<SopRunRow> {
    const runId = Number(row.id);
    return {
      id: runId,
      campaign_id: row.campaign_id != null ? Number(row.campaign_id) : null,
      template_id: row.template_id != null ? Number(row.template_id) : null,
      name: String(row.name ?? ''),
      status: String(row.status ?? ''),
      start_date: this.dateStr(row.start_date),
      notes: String(row.notes ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
      template_name: row.template_name != null ? String(row.template_name) : undefined,
      template_channel:
        row.template_channel != null ? String(row.template_channel) : undefined,
      campaign_name: row.campaign_name != null ? String(row.campaign_name) : undefined,
      campaign_code: row.campaign_code != null ? String(row.campaign_code) : undefined,
      stats: await this.runStats(runId),
    };
  }
}
