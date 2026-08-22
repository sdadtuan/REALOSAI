import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type { InsertVdJobInput, PatchVdJobInput, VdJobRow, VdJobStatus, VdQueue } from './vd-job.types';

type ProviderRefRow = {
  job_id: number;
  provider_code: string;
  provider_task_id: string;
};

type MemoryStore = {
  jobs: VdJobRow[];
  nextId: number;
  providerRefs: ProviderRefRow[];
};

function asRecord(value: unknown): Record<string, unknown> {
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

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

@Injectable()
export class VdJobRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = { jobs: [], nextId: 1, providerRefs: [] };
  last: VdJobRow = undefined as unknown as VdJobRow;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM vd_jobs LIMIT 1`);
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

  private remember(row: VdJobRow): VdJobRow {
    this.last = row;
    return row;
  }

  private mapRow(row: Record<string, unknown>): VdJobRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      shot_id: row.shot_id != null ? Number(row.shot_id) : null,
      queue: String(row.queue) as VdQueue,
      job_type: String(row.job_type ?? ''),
      status: String(row.status ?? 'queued') as VdJobStatus,
      error_class: row.error_class != null ? String(row.error_class) : null,
      attempt: Number(row.attempt ?? 0),
      idempotency_key: String(row.idempotency_key ?? ''),
      input_json: asRecord(row.input_json),
      output_json: asRecord(row.output_json),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async findByIdempotencyKey(key: string, projectId?: number): Promise<VdJobRow | null> {
    if (await this.ensurePgReady()) {
      const res =
        projectId != null
          ? await this.db.query(
              `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                      idempotency_key, input_json, output_json, created_at, updated_at
               FROM vd_jobs
               WHERE project_id = $1 AND idempotency_key = $2
               LIMIT 1`,
              [projectId, key],
            )
          : await this.db.query(
              `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                      idempotency_key, input_json, output_json, created_at, updated_at
               FROM vd_jobs
               WHERE idempotency_key = $1
               LIMIT 1`,
              [key],
            );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return (
      this.memory.jobs.find(
        (j) => j.idempotency_key === key && (projectId == null || j.project_id === projectId),
      ) ?? null
    );
  }

  async getById(id: number): Promise<VdJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                idempotency_key, input_json, output_json, created_at, updated_at
         FROM vd_jobs
         WHERE id = $1`,
        [id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    return this.memory.jobs.find((j) => j.id === id) ?? null;
  }

  async listByProjectId(projectId: number): Promise<VdJobRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                idempotency_key, input_json, output_json, created_at, updated_at
         FROM vd_jobs
         WHERE project_id = $1
         ORDER BY updated_at DESC`,
        [projectId],
      );
      return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
    }
    return this.memory.jobs
      .filter((j) => j.project_id === projectId)
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async insert(input: InsertVdJobInput): Promise<VdJobRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_jobs (
           project_id, shot_id, queue, job_type, status, error_class, attempt,
           idempotency_key, input_json, output_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
         RETURNING id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                   idempotency_key, input_json, output_json, created_at, updated_at`,
        [
          input.project_id,
          input.shot_id,
          input.queue,
          input.job_type,
          input.status,
          input.error_class ?? null,
          input.attempt ?? 0,
          input.idempotency_key,
          JSON.stringify(input.input_json),
          JSON.stringify(input.output_json ?? {}),
        ],
      );
      return this.remember(this.mapRow(res.rows[0] as Record<string, unknown>));
    }
    this.assertWritableOrThrow();
    const existing = this.memory.jobs.find((j) => j.idempotency_key === input.idempotency_key);
    if (existing) {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    }
    const now = new Date().toISOString();
    const row: VdJobRow = {
      id: this.memory.nextId++,
      project_id: input.project_id,
      shot_id: input.shot_id,
      queue: input.queue,
      job_type: input.job_type,
      status: input.status,
      error_class: input.error_class ?? null,
      attempt: input.attempt ?? 0,
      idempotency_key: input.idempotency_key,
      input_json: input.input_json,
      output_json: input.output_json ?? {},
      created_at: now,
      updated_at: now,
    };
    this.memory.jobs.push(row);
    return this.remember(row);
  }

  async update(id: number, patch: PatchVdJobInput): Promise<VdJobRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE vd_jobs
         SET status = COALESCE($2, status),
             error_class = CASE WHEN $3::bool THEN $4 ELSE error_class END,
             attempt = COALESCE($5, attempt),
             output_json = CASE WHEN $6::bool THEN $7::jsonb ELSE output_json END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, project_id, shot_id, queue, job_type, status, error_class, attempt,
                   idempotency_key, input_json, output_json, created_at, updated_at`,
        [
          id,
          patch.status ?? null,
          patch.error_class !== undefined,
          patch.error_class ?? null,
          patch.attempt ?? null,
          patch.output_json !== undefined,
          patch.output_json !== undefined ? JSON.stringify(patch.output_json) : null,
        ],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('vd_job_not_found');
      return this.remember(this.mapRow(row));
    }
    this.assertWritableOrThrow();
    const idx = this.memory.jobs.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error('vd_job_not_found');
    const current = this.memory.jobs[idx];
    const next: VdJobRow = {
      ...current,
      status: patch.status ?? current.status,
      error_class: patch.error_class !== undefined ? patch.error_class : current.error_class,
      attempt: patch.attempt ?? current.attempt,
      output_json: patch.output_json ?? current.output_json,
      updated_at: new Date().toISOString(),
    };
    this.memory.jobs[idx] = next;
    return this.remember(next);
  }

  private async findProviderRefByJobId(jobId: number): Promise<ProviderRefRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT job_id, provider_code, provider_task_id
         FROM vd_job_provider_ref
         WHERE job_id = $1
         LIMIT 1`,
        [jobId],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        job_id: Number(row.job_id),
        provider_code: String(row.provider_code),
        provider_task_id: String(row.provider_task_id),
      };
    }
    return this.memory.providerRefs.find((r) => r.job_id === jobId) ?? null;
  }

  async saveProviderRef(
    jobId: number,
    provider_code: string,
    provider_task_id: string,
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO vd_job_provider_ref (job_id, provider_code, provider_task_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (job_id) DO NOTHING
         RETURNING job_id, provider_code, provider_task_id`,
        [jobId, provider_code, provider_task_id],
      );
      if (!res.rows[0]) {
        await this.findProviderRefByJobId(jobId);
      }
      return;
    }
    this.assertWritableOrThrow();
    if (this.memory.providerRefs.some((r) => r.job_id === jobId)) {
      return;
    }
    if (
      this.memory.providerRefs.some(
        (r) => r.provider_code === provider_code && r.provider_task_id === provider_task_id,
      )
    ) {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    }
    this.memory.providerRefs.push({ job_id: jobId, provider_code, provider_task_id });
  }

  async findByProviderTask(
    provider_code: string,
    provider_task_id: string,
  ): Promise<VdJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT j.id, j.project_id, j.shot_id, j.queue, j.job_type, j.status, j.error_class, j.attempt,
                j.idempotency_key, j.input_json, j.output_json, j.created_at, j.updated_at
         FROM vd_job_provider_ref r
         JOIN vd_jobs j ON j.id = r.job_id
         WHERE r.provider_code = $1 AND r.provider_task_id = $2
         LIMIT 1`,
        [provider_code, provider_task_id],
      );
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return row ? this.mapRow(row) : null;
    }
    const ref = this.memory.providerRefs.find(
      (r) => r.provider_code === provider_code && r.provider_task_id === provider_task_id,
    );
    if (!ref) return null;
    return this.memory.jobs.find((j) => j.id === ref.job_id) ?? null;
  }

  async rememberRefIfAbsent(
    jobId: number,
    provider_code: string,
    submit: () => Promise<{ provider_task_id: string }>,
  ): Promise<{ provider_task_id: string }> {
    const existing = await this.findProviderRefByJobId(jobId);
    if (existing) {
      return { provider_task_id: existing.provider_task_id };
    }
    const result = await submit();
    try {
      await this.saveProviderRef(jobId, provider_code, result.provider_task_id);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const raced = await this.findProviderRefByJobId(jobId);
        if (raced) return { provider_task_id: raced.provider_task_id };
      }
      throw err;
    }
    const stored = await this.findProviderRefByJobId(jobId);
    if (stored) return { provider_task_id: stored.provider_task_id };
    return { provider_task_id: result.provider_task_id };
  }

  async saveSaga(
    jobId: number,
    saga: Record<string, unknown>,
  ): Promise<VdJobRow> {
    const current = await this.getById(jobId);
    if (!current) throw new Error('vd_job_not_found');
    const output_json = {
      ...current.output_json,
      saga,
    };
    return this.update(jobId, { output_json });
  }
}
