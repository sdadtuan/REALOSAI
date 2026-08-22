import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import { VALID_STAGES } from './service-lifecycle.types';

export interface SvcTaskRow {
  id: number;
  lifecycle_id: number;
  stage: string;
  step_index: number;
  title: string;
  description: string;
  form_fields: unknown[];
  form_data: Record<string, unknown>;
  ai_prompt_key: string;
  ai_output: string;
  is_done: boolean;
  done_at: string;
  done_by: number | null;
  notes: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class LifecycleTasksPgRepository implements OnModuleDestroy {
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

  private mapTask(row: Record<string, unknown>): SvcTaskRow {
    const formFieldsRaw = row.form_fields;
    const formDataRaw = row.form_data;
    let formFields: unknown[] = [];
    let formData: Record<string, unknown> = {};
    if (Array.isArray(formFieldsRaw)) formFields = formFieldsRaw;
    else if (typeof formFieldsRaw === 'string') {
      try {
        formFields = JSON.parse(formFieldsRaw) as unknown[];
      } catch {
        formFields = [];
      }
    }
    if (formDataRaw && typeof formDataRaw === 'object' && !Array.isArray(formDataRaw)) {
      formData = formDataRaw as Record<string, unknown>;
    } else if (typeof formDataRaw === 'string') {
      try {
        formData = JSON.parse(formDataRaw) as Record<string, unknown>;
      } catch {
        formData = {};
      }
    }
    return {
      id: Number(row.id),
      lifecycle_id: Number(row.lifecycle_id),
      stage: String(row.stage ?? ''),
      step_index: Number(row.step_index ?? 0),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      form_fields: formFields,
      form_data: formData,
      ai_prompt_key: String(row.ai_prompt_key ?? ''),
      ai_output: String(row.ai_output ?? ''),
      is_done: row.is_done === true || row.is_done === 1,
      done_at: row.done_at ? String(row.done_at) : '',
      done_by: row.done_by != null ? Number(row.done_by) : null,
      notes: String(row.notes ?? ''),
      is_custom: row.is_custom === true || row.is_custom === 1,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async listTasksGrouped(lifecycleId: number): Promise<Record<string, SvcTaskRow[]>> {
    const result = await this.db.query(
      `SELECT * FROM crm_svc_tasks WHERE lifecycle_id = $1
       ORDER BY stage, step_index ASC, id ASC`,
      [lifecycleId],
    );
    const out: Record<string, SvcTaskRow[]> = {};
    for (const stage of VALID_STAGES) out[stage] = [];
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const task = this.mapTask(row);
      if (!out[task.stage]) out[task.stage] = [];
      out[task.stage].push(task);
    }
    return out;
  }

  async getTask(taskId: number): Promise<SvcTaskRow | null> {
    const result = await this.db.query(`SELECT * FROM crm_svc_tasks WHERE id = $1`, [taskId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTask(row) : null;
  }

  async isStageComplete(lifecycleId: number, stage: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
       FROM crm_svc_tasks WHERE lifecycle_id = $1 AND stage = $2`,
      [lifecycleId, stage],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    if (total === 0) return true;
    return Number(result.rows[0]?.done ?? 0) >= total;
  }

  async getProgress(
    lifecycleId: number,
  ): Promise<Record<string, { total: number; done: number; pct: number }>> {
    const out: Record<string, { total: number; done: number; pct: number }> = {};
    for (const stage of VALID_STAGES) {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN is_done THEN 1 ELSE 0 END)::int AS done
         FROM crm_svc_tasks WHERE lifecycle_id = $1 AND stage = $2`,
        [lifecycleId, stage],
      );
      const total = Number(result.rows[0]?.total ?? 0);
      const done = Number(result.rows[0]?.done ?? 0);
      out[stage] = { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 100 };
    }
    return out;
  }

  async updateTask(
    taskId: number,
    patch: { is_done?: boolean; notes?: string; form_data?: Record<string, unknown>; done_by?: number | null },
  ): Promise<SvcTaskRow | null> {
    const existing = await this.getTask(taskId);
    if (!existing) return null;
    const ts = catalogTs();
    let isDone = existing.is_done;
    let doneAt: string | null = existing.done_at || null;
    if (patch.is_done != null) {
      isDone = patch.is_done;
      doneAt = patch.is_done ? ts : null;
    }
    const notes = patch.notes != null ? String(patch.notes).slice(0, 2000) : existing.notes;
    const formData =
      patch.form_data != null ? JSON.stringify(patch.form_data) : JSON.stringify(existing.form_data);
    const doneBy = patch.done_by !== undefined ? patch.done_by : existing.done_by;
    await this.db.query(
      `UPDATE crm_svc_tasks
       SET is_done = $2, done_at = $3::timestamptz, done_by = $4, notes = $5,
           form_data = $6::jsonb, updated_at = $7::timestamptz
       WHERE id = $1`,
      [taskId, isDone, doneAt, doneBy, notes, formData, ts],
    );
    return this.getTask(taskId);
  }

  async createCustomTask(
    lifecycleId: number,
    stage: string,
    title: string,
    description: string,
  ): Promise<SvcTaskRow> {
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_svc_tasks
         (lifecycle_id, stage, step_index, title, description, form_fields, form_data,
          ai_prompt_key, ai_output, is_done, notes, is_custom, created_at, updated_at)
       VALUES ($1, $2, 999, $3, $4, '[]'::jsonb, '{}'::jsonb, '', '', FALSE, '', TRUE, $5::timestamptz, $5::timestamptz)
       RETURNING id`,
      [lifecycleId, stage, title.slice(0, 400), description.slice(0, 4000), ts],
    );
    const id = Number(result.rows[0]?.id);
    return (await this.getTask(id))!;
  }
}
