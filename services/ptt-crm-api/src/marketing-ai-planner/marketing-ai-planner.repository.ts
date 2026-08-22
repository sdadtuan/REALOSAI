import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { emptyDraft } from './marketing-ai-brief.util';
import type {
  MktAiApprovalRow,
  MktAiApprovalStatus,
  MktAiBrief,
  MktAiBudgetScenarioRow,
  MktAiCommentRow,
  MktAiCompetitorSnapshot,
  MktAiDocumentRow,
  MktAiDocumentStatus,
  MktAiDraft,
  MktAiJobRow,
  MktAiJobStatus,
  MktAiJobType,
  MktAiPlanVersionRow,
  MktAiPlanVersionStatus,
  MktAiRagChunkHit,
  MktAiSectionCommentRow,
  MktAiStrategyScenarioRow,
} from './marketing-ai-planner.types';
import type { MktAiBudgetScenarioDraft } from './marketing-ai-budget.util';
import type { MktAiTextChunk } from './marketing-ai-rag.util';

type MemoryStore = {
  briefs: Map<number, { brief_json: MktAiBrief; prefill_sources_json: string[]; updated_by: string }>;
  drafts: Map<number, MktAiDraft & { updated_by: string }>;
  jobs: MktAiJobRow[];
  campaigns: Map<number, unknown[]>;
  content: Map<number, unknown[]>;
  exports: Array<Record<string, unknown>>;
  documents: MktAiDocumentRow[];
  budgetScenarios: MktAiBudgetScenarioRow[];
  strategyScenarios: MktAiStrategyScenarioRow[];
  sectionComments: MktAiSectionCommentRow[];
  planVersions: MktAiPlanVersionRow[];
  approvals: MktAiApprovalRow[];
  comments: MktAiCommentRow[];
  chunks: Array<{
    id: number;
    document_id: number;
    chunk_index: number;
    page_no: number | null;
    title: string;
    body: string;
    token_count: number | null;
  }>;
  nextJobId: number;
  nextDocumentId: number;
  nextChunkId: number;
  nextBudgetScenarioId: number;
  nextStrategyScenarioId: number;
  nextSectionCommentId: number;
  nextPlanVersionId: number;
  nextApprovalId: number;
  nextCommentId: number;
};

@Injectable()
export class MarketingAiPlannerRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    briefs: new Map(),
    drafts: new Map(),
    jobs: [],
    campaigns: new Map(),
    content: new Map(),
    exports: [],
    documents: [],
    budgetScenarios: [],
    strategyScenarios: [],
    sectionComments: [],
    planVersions: [],
    approvals: [],
    comments: [],
    chunks: [],
    nextJobId: 1,
    nextDocumentId: 1,
    nextChunkId: 1,
    nextBudgetScenarioId: 1,
    nextStrategyScenarioId: 1,
    nextSectionCommentId: 1,
    nextPlanVersionId: 1,
    nextApprovalId: 1,
    nextCommentId: 1,
  };

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

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM mkt_ai_briefs LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  async getBrief(lifecycleId: number): Promise<{
    brief_json: MktAiBrief;
    prefill_sources_json: string[];
    updated_by: string;
  } | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT brief_json, prefill_sources_json, updated_by FROM mkt_ai_briefs WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      if (!res.rows[0]) return null;
      return {
        brief_json: res.rows[0].brief_json as MktAiBrief,
        prefill_sources_json: (res.rows[0].prefill_sources_json as string[]) ?? [],
        updated_by: String(res.rows[0].updated_by ?? ''),
      };
    }
    return this.memory.briefs.get(lifecycleId) ?? null;
  }

  async upsertBrief(
    lifecycleId: number,
    brief: MktAiBrief,
    prefillSources: string[],
    actorEmail: string,
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, validation_json, created_by, updated_by)
         VALUES ($1, $2::jsonb, $3::jsonb, '{}'::jsonb, $4, $4)
         ON CONFLICT (lifecycle_id) DO UPDATE SET
           brief_json = EXCLUDED.brief_json,
           prefill_sources_json = EXCLUDED.prefill_sources_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [lifecycleId, JSON.stringify(brief), JSON.stringify(prefillSources), actorEmail],
      );
      return;
    }
    this.memory.briefs.set(lifecycleId, {
      brief_json: brief,
      prefill_sources_json: prefillSources,
      updated_by: actorEmail,
    });
  }

  async getDraft(lifecycleId: number): Promise<MktAiDraft | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT strategy_framework_json, target_market_prof_json, swot_json, campaigns_json,
                content_json, quality_score_json, kpi_tree_json,
                COALESCE(competitor_snapshot_json, '{}'::jsonb) AS competitor_snapshot_json,
                COALESCE(kpi_tree_applied_json, '[]'::jsonb) AS kpi_tree_applied_json
         FROM mkt_ai_drafts WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0];
      return {
        strategy_framework: (r.strategy_framework_json as Record<string, string>) ?? {},
        target_market_prof: (r.target_market_prof_json as Record<string, string>) ?? {},
        swot_json: (r.swot_json as Record<string, unknown>) ?? {},
        campaigns_json: (r.campaigns_json as MktAiDraft['campaigns_json']) ?? [],
        content_json: (r.content_json as Record<string, unknown>) ?? {},
        quality_score_json: (r.quality_score_json as Record<string, unknown>) ?? {},
        kpi_tree_json: (r.kpi_tree_json as MktAiDraft['kpi_tree_json']) ?? [],
        competitor_snapshot_json: (r.competitor_snapshot_json as MktAiCompetitorSnapshot) ?? undefined,
        kpi_tree_applied_json: (r.kpi_tree_applied_json as MktAiDraft['kpi_tree_applied_json']) ?? [],
      };
    }
    const row = this.memory.drafts.get(lifecycleId);
    if (!row) return null;
    const { updated_by: _u, ...draft } = row;
    return draft;
  }

  async upsertDraft(lifecycleId: number, draft: MktAiDraft, actorEmail: string): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO mkt_ai_drafts (
           lifecycle_id, strategy_framework_json, target_market_prof_json, swot_json,
           campaigns_json, content_json, quality_score_json, kpi_tree_json,
           competitor_snapshot_json, kpi_tree_applied_json, updated_by
         ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11)
         ON CONFLICT (lifecycle_id) DO UPDATE SET
           strategy_framework_json = EXCLUDED.strategy_framework_json,
           target_market_prof_json = EXCLUDED.target_market_prof_json,
           swot_json = EXCLUDED.swot_json,
           campaigns_json = EXCLUDED.campaigns_json,
           content_json = EXCLUDED.content_json,
           quality_score_json = EXCLUDED.quality_score_json,
           kpi_tree_json = EXCLUDED.kpi_tree_json,
           competitor_snapshot_json = EXCLUDED.competitor_snapshot_json,
           kpi_tree_applied_json = EXCLUDED.kpi_tree_applied_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          lifecycleId,
          JSON.stringify(draft.strategy_framework ?? {}),
          JSON.stringify(draft.target_market_prof ?? {}),
          JSON.stringify(draft.swot_json ?? {}),
          JSON.stringify(draft.campaigns_json ?? []),
          JSON.stringify(draft.content_json ?? {}),
          JSON.stringify(draft.quality_score_json ?? {}),
          JSON.stringify(draft.kpi_tree_json ?? []),
          JSON.stringify(draft.competitor_snapshot_json ?? {}),
          JSON.stringify(draft.kpi_tree_applied_json ?? []),
          actorEmail,
        ],
      );
      return;
    }
    this.memory.drafts.set(lifecycleId, { ...draft, updated_by: actorEmail });
  }

  async ensureDraft(lifecycleId: number, actorEmail: string): Promise<MktAiDraft> {
    const existing = await this.getDraft(lifecycleId);
    if (existing) return existing;
    const draft = emptyDraft() as MktAiDraft;
    await this.upsertDraft(lifecycleId, draft, actorEmail);
    return draft;
  }

  async listJobs(lifecycleId: number, limit = 20): Promise<MktAiJobRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_type, status, prompt_version, model_name,
                input_json, output_json, error_message, latency_ms, actor_email,
                started_at, ended_at, created_at
         FROM mkt_ai_jobs WHERE lifecycle_id = $1 ORDER BY id DESC LIMIT $2`,
        [lifecycleId, limit],
      );
      return res.rows.map((r) => this.mapJobRow(r));
    }
    return this.memory.jobs
      .filter((j) => j.lifecycle_id === lifecycleId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  async createJob(input: {
    lifecycle_id: number;
    job_type: MktAiJobType;
    model_name: string;
    prompt_version?: string;
    input_json: Record<string, unknown>;
    actor_email: string;
    status?: MktAiJobStatus;
  }): Promise<MktAiJobRow> {
    const started = this.nowIso();
    const promptVersion = input.prompt_version ?? 'v1';
    const initialStatus = input.status ?? 'running';
    const startedAt = initialStatus === 'pending' ? null : started;
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_jobs (
           lifecycle_id, job_type, status, prompt_version, model_name,
           input_json, actor_email, started_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW(), NOW())
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [
          input.lifecycle_id,
          input.job_type,
          initialStatus,
          promptVersion,
          input.model_name,
          JSON.stringify(input.input_json),
          input.actor_email,
          startedAt,
        ],
      );
      return this.mapJobRow(res.rows[0]);
    }
    const id = this.memory.nextJobId++;
    const row: MktAiJobRow = {
      id,
      lifecycle_id: input.lifecycle_id,
      job_type: input.job_type,
      status: initialStatus,
      prompt_version: promptVersion,
      model_name: input.model_name,
      input_json: input.input_json,
      output_json: {},
      error_message: null,
      latency_ms: null,
      actor_email: input.actor_email,
      started_at: initialStatus === 'pending' ? null : started,
      ended_at: null,
      created_at: started,
    };
    this.memory.jobs.push(row);
    return row;
  }

  async getJobById(jobId: number): Promise<MktAiJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_type, status, prompt_version, model_name,
                input_json, output_json, error_message, latency_ms, actor_email,
                started_at, ended_at, created_at
         FROM mkt_ai_jobs WHERE id = $1`,
        [jobId],
      );
      return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
    }
    return this.memory.jobs.find((j) => j.id === jobId) ?? null;
  }

  async patchJob(
    jobId: number,
    patch: {
      status?: MktAiJobStatus;
      output_json?: Record<string, unknown>;
      error_message?: string | null;
      latency_ms?: number;
    },
  ): Promise<MktAiJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_jobs SET
           status = COALESCE($2, status),
           output_json = COALESCE($3::jsonb, output_json),
           error_message = COALESCE($4, error_message),
           latency_ms = COALESCE($5, latency_ms),
           started_at = CASE WHEN $2::text = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [
          jobId,
          patch.status ?? null,
          patch.output_json ? JSON.stringify(patch.output_json) : null,
          patch.error_message === undefined ? null : patch.error_message,
          patch.latency_ms ?? null,
        ],
      );
      return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
    }
    const row = this.memory.jobs.find((j) => j.id === jobId);
    if (!row) return null;
    if (patch.status) row.status = patch.status;
    if (patch.output_json) row.output_json = patch.output_json;
    if (patch.error_message !== undefined) row.error_message = patch.error_message;
    if (patch.latency_ms != null) row.latency_ms = patch.latency_ms;
    if (patch.status === 'running' && !row.started_at) row.started_at = this.nowIso();
    return row;
  }

  async claimPendingMultiAgentJob(jobId: number): Promise<MktAiJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_jobs SET status = 'running', started_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND job_type = 'multi_agent' AND status = 'pending'
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [jobId],
      );
      return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
    }
    const row = this.memory.jobs.find(
      (j) => j.id === jobId && j.job_type === 'multi_agent' && j.status === 'pending',
    );
    if (!row) return null;
    row.status = 'running';
    row.started_at = this.nowIso();
    return row;
  }

  async listPendingMultiAgentJobs(limit = 10): Promise<MktAiJobRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_type, status, prompt_version, model_name,
                input_json, output_json, error_message, latency_ms, actor_email,
                started_at, ended_at, created_at
         FROM mkt_ai_jobs
         WHERE job_type = 'multi_agent' AND status = 'pending'
         ORDER BY id ASC
         LIMIT $1`,
        [limit],
      );
      return res.rows.map((r) => this.mapJobRow(r));
    }
    return this.memory.jobs
      .filter((j) => j.job_type === 'multi_agent' && j.status === 'pending')
      .sort((a, b) => a.id - b.id)
      .slice(0, limit);
  }

  async finishJob(
    jobId: number,
    patch: {
      status: MktAiJobStatus;
      output_json?: Record<string, unknown>;
      error_message?: string | null;
      latency_ms?: number;
    },
  ): Promise<MktAiJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_jobs SET
           status = $2,
           output_json = COALESCE($3::jsonb, output_json),
           error_message = $4,
           latency_ms = $5,
           ended_at = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [
          jobId,
          patch.status,
          patch.output_json ? JSON.stringify(patch.output_json) : null,
          patch.error_message ?? null,
          patch.latency_ms ?? null,
        ],
      );
      return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
    }
    const row = this.memory.jobs.find((j) => j.id === jobId);
    if (!row) return null;
    row.status = patch.status;
    if (patch.output_json) row.output_json = patch.output_json;
    row.error_message = patch.error_message ?? null;
    row.latency_ms = patch.latency_ms ?? null;
    row.ended_at = this.nowIso();
    return row;
  }

  async replaceCampaigns(lifecycleId: number, jobId: number | null, campaigns: unknown[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_campaigns WHERE lifecycle_id = $1`, [lifecycleId]);
      for (let i = 0; i < campaigns.length; i++) {
        const c = campaigns[i] as Record<string, unknown>;
        await this.db.query(
          `INSERT INTO mkt_ai_campaigns (
             lifecycle_id, job_id, name, objective, channel_mix_json, budget_pct,
             timeline_json, milestones_json, kpis_json, sort_order
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)`,
          [
            lifecycleId,
            jobId,
            String(c.name ?? ''),
            String(c.objective ?? 'lead'),
            JSON.stringify(c.channel_mix ?? []),
            Number(c.budget_pct ?? 0),
            JSON.stringify({ weeks: c.timeline_weeks ?? '' }),
            JSON.stringify(c.milestones ?? []),
            JSON.stringify(c.kpis ?? []),
            i,
          ],
        );
      }
      return;
    }
    this.memory.campaigns.set(lifecycleId, campaigns);
  }

  async replaceContentAssets(lifecycleId: number, jobId: number | null, assets: unknown[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_content_assets WHERE lifecycle_id = $1`, [lifecycleId]);
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i] as Record<string, unknown>;
        await this.db.query(
          `INSERT INTO mkt_ai_content_assets (
             lifecycle_id, job_id, asset_type, title, body_text, content_json,
             scheduled_date, channel, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
          [
            lifecycleId,
            jobId,
            String(a.asset_type ?? 'calendar'),
            String(a.title ?? ''),
            String(a.body_text ?? ''),
            JSON.stringify(a.content_json ?? {}),
            a.scheduled_date ? String(a.scheduled_date) : null,
            String(a.channel ?? ''),
            i,
          ],
        );
      }
      return;
    }
    this.memory.content.set(lifecycleId, assets);
  }

  async createExport(row: {
    lifecycle_id: number;
    format: string;
    exported_by: string;
    quality_score: number;
  }): Promise<{ id: number }> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_exports (lifecycle_id, format, exported_by, quality_score)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [row.lifecycle_id, row.format, row.exported_by, row.quality_score],
      );
      return { id: Number(res.rows[0].id) };
    }
    const id = this.memory.exports.length + 1;
    this.memory.exports.push({ id, ...row, created_at: this.nowIso() });
    return { id };
  }

  async listDocuments(lifecycleId: number): Promise<MktAiDocumentRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                error_message, uploaded_by, metadata_json, created_at, updated_at
         FROM mkt_ai_documents
         WHERE lifecycle_id = $1 AND status <> 'archived'
         ORDER BY created_at DESC`,
        [lifecycleId],
      );
      return res.rows.map((r) => this.mapDocumentRow(r));
    }
    return this.memory.documents
      .filter((d) => d.lifecycle_id === lifecycleId && d.status !== 'archived')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async findDocumentByHash(lifecycleId: number, sha256Hex: string): Promise<MktAiDocumentRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                error_message, uploaded_by, created_at, updated_at
         FROM mkt_ai_documents
         WHERE lifecycle_id = $1 AND sha256_hex = $2 AND status <> 'archived'
         ORDER BY id DESC LIMIT 1`,
        [lifecycleId, sha256Hex],
      );
      return res.rows[0] ? this.mapDocumentRow(res.rows[0]) : null;
    }
    return (
      this.memory.documents.find(
        (d) =>
          d.lifecycle_id === lifecycleId &&
          d.status !== 'archived',
      ) ?? null
    );
  }

  async insertDocument(row: {
    lifecycle_id: number;
    filename: string;
    mime_type: string;
    storage_key: string;
    file_size_bytes: number;
    sha256_hex: string;
    status: MktAiDocumentStatus;
    uploaded_by: string;
    metadata_json?: Record<string, unknown>;
  }): Promise<MktAiDocumentRow> {
    const now = this.nowIso();
    const metadata = row.metadata_json ?? {};
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_documents (
           lifecycle_id, filename, mime_type, storage_key, file_size_bytes, sha256_hex,
           metadata_json, status, chunk_count, uploaded_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 0, $9, NOW(), NOW())
         RETURNING id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                   error_message, uploaded_by, metadata_json, created_at, updated_at`,
        [
          row.lifecycle_id,
          row.filename,
          row.mime_type,
          row.storage_key,
          row.file_size_bytes,
          row.sha256_hex,
          JSON.stringify(metadata),
          row.status,
          row.uploaded_by,
        ],
      );
      return this.mapDocumentRow(res.rows[0]);
    }
    const doc: MktAiDocumentRow = {
      id: this.memory.nextDocumentId++,
      lifecycle_id: row.lifecycle_id,
      filename: row.filename,
      mime_type: row.mime_type,
      file_size_bytes: row.file_size_bytes,
      status: row.status,
      chunk_count: 0,
      error_message: null,
      uploaded_by: row.uploaded_by,
      metadata_json: row.metadata_json,
      created_at: now,
      updated_at: now,
    };
    this.memory.documents.push(doc);
    return doc;
  }

  async updateDocument(
    documentId: number,
    patch: {
      status: MktAiDocumentStatus;
      chunk_count: number;
      error_message: string | null;
    },
  ): Promise<MktAiDocumentRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_documents SET
           status = $2,
           chunk_count = $3,
           error_message = $4,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                   error_message, uploaded_by, created_at, updated_at`,
        [documentId, patch.status, patch.chunk_count, patch.error_message],
      );
      return this.mapDocumentRow(res.rows[0]);
    }
    const doc = this.memory.documents.find((d) => d.id === documentId);
    if (!doc) throw new Error('document_not_found');
    doc.status = patch.status;
    doc.chunk_count = patch.chunk_count;
    doc.error_message = patch.error_message;
    doc.updated_at = this.nowIso();
    return doc;
  }

  async replaceDocumentChunks(documentId: number, chunks: MktAiTextChunk[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_document_chunks WHERE document_id = $1`, [documentId]);
      for (const chunk of chunks) {
        await this.db.query(
          `INSERT INTO mkt_ai_document_chunks (
             document_id, chunk_index, page_no, title, body, token_count, metadata_json
           ) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
          [
            documentId,
            chunk.chunk_index,
            chunk.page_no,
            chunk.title,
            chunk.body,
            chunk.token_count,
          ],
        );
      }
      return;
    }
    this.memory.chunks = this.memory.chunks.filter((c) => c.document_id !== documentId);
    for (const chunk of chunks) {
      this.memory.chunks.push({
        id: this.memory.nextChunkId++,
        document_id: documentId,
        chunk_index: chunk.chunk_index,
        page_no: chunk.page_no,
        title: chunk.title,
        body: chunk.body,
        token_count: chunk.token_count,
      });
    }
  }

  async searchDocumentChunks(
    lifecycleId: number,
    query: string,
    limit = 5,
  ): Promise<MktAiRagChunkHit[]> {
    const q = String(query ?? '').trim();
    if (!q) return this.listTopDocumentChunks(lifecycleId, limit);

    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT c.id AS chunk_id, c.document_id, c.chunk_index, c.page_no, c.title, c.body,
                d.filename,
                ts_rank(
                  to_tsvector('simple', coalesce(c.title, '') || ' ' || c.body),
                  plainto_tsquery('simple', $2)
                ) AS rank
         FROM mkt_ai_document_chunks c
         JOIN mkt_ai_documents d ON d.id = c.document_id
         WHERE d.lifecycle_id = $1
           AND d.status = 'indexed'
           AND to_tsvector('simple', coalesce(c.title, '') || ' ' || c.body) @@ plainto_tsquery('simple', $2)
         ORDER BY rank DESC, c.id ASC
         LIMIT $3`,
        [lifecycleId, q, limit],
      );
      if (res.rows.length) {
        return res.rows.map((r) => this.mapChunkHit(r));
      }
    }

    return this.searchDocumentChunksMemory(lifecycleId, q, limit);
  }

  async listTopDocumentChunks(lifecycleId: number, limit = 5): Promise<MktAiRagChunkHit[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT c.id AS chunk_id, c.document_id, c.chunk_index, c.page_no, c.title, c.body,
                d.filename, 1.0 AS rank
         FROM mkt_ai_document_chunks c
         JOIN mkt_ai_documents d ON d.id = c.document_id
         WHERE d.lifecycle_id = $1 AND d.status = 'indexed'
         ORDER BY c.document_id ASC, c.chunk_index ASC
         LIMIT $2`,
        [lifecycleId, limit],
      );
      if (res.rows.length) {
        return res.rows.map((r) => this.mapChunkHit(r));
      }
    }
    return this.searchDocumentChunksMemory(lifecycleId, '', limit);
  }

  private searchDocumentChunksMemory(
    lifecycleId: number,
    query: string,
    limit: number,
  ): MktAiRagChunkHit[] {
    const indexedDocIds = new Set(
      this.memory.documents
        .filter((d) => d.lifecycle_id === lifecycleId && d.status === 'indexed')
        .map((d) => d.id),
    );
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = this.memory.chunks
      .filter((c) => indexedDocIds.has(c.document_id))
      .map((c) => {
        const doc = this.memory.documents.find((d) => d.id === c.document_id)!;
        const hay = `${c.title} ${c.body}`.toLowerCase();
        const rank = terms.length
          ? terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0)
          : 1;
        return {
          chunk_id: c.id,
          document_id: c.document_id,
          chunk_index: c.chunk_index,
          page_no: c.page_no,
          filename: doc.filename,
          title: c.title,
          body: c.body,
          rank,
        };
      })
      .filter((h) => h.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.chunk_index - b.chunk_index)
      .slice(0, limit);
    return hits;
  }

  async listBudgetScenarios(lifecycleId: number): Promise<MktAiBudgetScenarioRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_id, name, slug, budget_monthly_vnd,
                channel_mix_json, cpl_estimates_json, assumptions_json,
                is_selected, sort_order, created_at, updated_at
         FROM mkt_ai_budget_scenarios
         WHERE lifecycle_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [lifecycleId],
      );
      return res.rows.map((r) => this.mapBudgetScenarioRow(r));
    }
    return this.memory.budgetScenarios
      .filter((s) => s.lifecycle_id === lifecycleId)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }

  async replaceBudgetScenarios(
    lifecycleId: number,
    jobId: number | null,
    scenarios: MktAiBudgetScenarioDraft[],
  ): Promise<MktAiBudgetScenarioRow[]> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_budget_scenarios WHERE lifecycle_id = $1`, [lifecycleId]);
      const rows: MktAiBudgetScenarioRow[] = [];
      for (const s of scenarios) {
        const res = await this.db.query(
          `INSERT INTO mkt_ai_budget_scenarios (
             lifecycle_id, job_id, name, slug, budget_monthly_vnd,
             channel_mix_json, cpl_estimates_json, assumptions_json, rationale_vi,
             is_selected, sort_order, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, FALSE, $10, NOW(), NOW())
           RETURNING id, lifecycle_id, job_id, name, slug, budget_monthly_vnd,
                     channel_mix_json, cpl_estimates_json, assumptions_json, rationale_vi,
                     is_selected, sort_order, created_at, updated_at`,
          [
            lifecycleId,
            jobId,
            s.name,
            s.slug,
            s.budget_monthly_vnd,
            JSON.stringify(s.channel_mix_json),
            JSON.stringify(s.cpl_estimates_json),
            JSON.stringify(s.assumptions_json),
            s.rationale_vi ?? String(s.assumptions_json?.note ?? ''),
            s.sort_order,
          ],
        );
        rows.push(this.mapBudgetScenarioRow(res.rows[0]));
      }
      return rows;
    }

    this.memory.budgetScenarios = this.memory.budgetScenarios.filter(
      (s) => s.lifecycle_id !== lifecycleId,
    );
    const now = this.nowIso();
    const rows: MktAiBudgetScenarioRow[] = scenarios.map((s) => {
      const row: MktAiBudgetScenarioRow = {
        id: this.memory.nextBudgetScenarioId++,
        lifecycle_id: lifecycleId,
        job_id: jobId,
        name: s.name,
        slug: s.slug,
        budget_monthly_vnd: s.budget_monthly_vnd,
        channel_mix_json: s.channel_mix_json as unknown as Record<string, number>,
        cpl_estimates_json: s.cpl_estimates_json,
        assumptions_json: s.assumptions_json,
        rationale_vi: s.rationale_vi ?? null,
        is_selected: false,
        sort_order: s.sort_order,
        created_at: now,
        updated_at: now,
      };
      this.memory.budgetScenarios.push(row);
      return row;
    });
    return rows;
  }

  async selectBudgetScenario(lifecycleId: number, scenarioId: number): Promise<MktAiBudgetScenarioRow | null> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE mkt_ai_budget_scenarios SET is_selected = FALSE, updated_at = NOW()
         WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      const res = await this.db.query(
        `UPDATE mkt_ai_budget_scenarios SET is_selected = TRUE, updated_at = NOW()
         WHERE lifecycle_id = $1 AND id = $2
         RETURNING id, lifecycle_id, job_id, name, slug, budget_monthly_vnd,
                   channel_mix_json, cpl_estimates_json, assumptions_json,
                   is_selected, sort_order, created_at, updated_at`,
        [lifecycleId, scenarioId],
      );
      return res.rows[0] ? this.mapBudgetScenarioRow(res.rows[0]) : null;
    }

    let selected: MktAiBudgetScenarioRow | null = null;
    for (const row of this.memory.budgetScenarios) {
      if (row.lifecycle_id !== lifecycleId) continue;
      row.is_selected = row.id === scenarioId;
      if (row.is_selected) selected = row;
    }
    return selected;
  }

  async getBudgetScenario(
    lifecycleId: number,
    scenarioId: number,
  ): Promise<MktAiBudgetScenarioRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_id, name, slug, budget_monthly_vnd,
                channel_mix_json, cpl_estimates_json, assumptions_json,
                is_selected, sort_order, created_at, updated_at
         FROM mkt_ai_budget_scenarios
         WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, scenarioId],
      );
      return res.rows[0] ? this.mapBudgetScenarioRow(res.rows[0]) : null;
    }
    return (
      this.memory.budgetScenarios.find(
        (s) => s.lifecycle_id === lifecycleId && s.id === scenarioId,
      ) ?? null
    );
  }

  private mapBudgetScenarioRow(r: Record<string, unknown>): MktAiBudgetScenarioRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      job_id: r.job_id != null ? Number(r.job_id) : null,
      name: String(r.name ?? ''),
      slug: String(r.slug ?? ''),
      budget_monthly_vnd: Number(r.budget_monthly_vnd ?? 0),
      channel_mix_json: (r.channel_mix_json as Record<string, number>) ?? {},
      cpl_estimates_json: (r.cpl_estimates_json as Record<string, number>) ?? {},
      assumptions_json: (r.assumptions_json as Record<string, unknown>) ?? {},
      rationale_vi: r.rationale_vi != null ? String(r.rationale_vi) : null,
      is_selected: Boolean(r.is_selected),
      sort_order: Number(r.sort_order ?? 0),
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapDocumentRow(r: Record<string, unknown>): MktAiDocumentRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      filename: String(r.filename ?? ''),
      mime_type: String(r.mime_type ?? ''),
      file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
      status: String(r.status ?? 'pending') as MktAiDocumentStatus,
      chunk_count: Number(r.chunk_count ?? 0),
      error_message: r.error_message != null ? String(r.error_message) : null,
      uploaded_by: String(r.uploaded_by ?? ''),
      metadata_json:
        r.metadata_json && typeof r.metadata_json === 'object'
          ? (r.metadata_json as Record<string, unknown>)
          : undefined,
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapChunkHit(r: Record<string, unknown>): MktAiRagChunkHit {
    return {
      chunk_id: Number(r.chunk_id),
      document_id: Number(r.document_id),
      chunk_index: Number(r.chunk_index),
      page_no: r.page_no != null ? Number(r.page_no) : null,
      filename: String(r.filename ?? ''),
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      rank: Number(r.rank ?? 0),
    };
  }

  async getNextPlanVersionNo(lifecycleId: number): Promise<number> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no
         FROM mkt_ai_plan_versions WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      return Number(res.rows[0]?.next_no ?? 1);
    }
    const max = this.memory.planVersions
      .filter((v) => v.lifecycle_id === lifecycleId)
      .reduce((acc, v) => Math.max(acc, v.version_no), 0);
    return max + 1;
  }

  async createPlanVersion(row: {
    lifecycle_id: number;
    version_no: number;
    label: string;
    status: MktAiPlanVersionStatus;
    brief_json: MktAiBrief;
    strategy_framework_json: Record<string, string>;
    target_market_prof_json: Record<string, string>;
    campaigns_json: MktAiDraft['campaigns_json'];
    content_json: Record<string, unknown>;
    quality_score_json: Record<string, unknown>;
    created_by: string;
  }): Promise<MktAiPlanVersionRow> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_plan_versions (
           lifecycle_id, version_no, label, status, brief_json,
           strategy_framework_json, target_market_prof_json, campaigns_json,
           content_json, quality_score_json, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11, NOW())
         RETURNING id, lifecycle_id, version_no, label, status, brief_json,
                   strategy_framework_json, target_market_prof_json, campaigns_json,
                   content_json, quality_score_json, marketing_plan_id, applied_at,
                   created_by, created_at::text`,
        [
          row.lifecycle_id,
          row.version_no,
          row.label,
          row.status,
          JSON.stringify(row.brief_json),
          JSON.stringify(row.strategy_framework_json),
          JSON.stringify(row.target_market_prof_json),
          JSON.stringify(row.campaigns_json ?? []),
          JSON.stringify(row.content_json ?? {}),
          JSON.stringify(row.quality_score_json ?? {}),
          row.created_by,
        ],
      );
      return this.mapPlanVersionRow(res.rows[0]);
    }
    const version: MktAiPlanVersionRow = {
      id: this.memory.nextPlanVersionId++,
      lifecycle_id: row.lifecycle_id,
      version_no: row.version_no,
      label: row.label,
      status: row.status,
      brief_json: row.brief_json,
      strategy_framework_json: row.strategy_framework_json,
      target_market_prof_json: row.target_market_prof_json,
      campaigns_json: row.campaigns_json ?? [],
      content_json: row.content_json ?? {},
      quality_score_json: row.quality_score_json ?? {},
      marketing_plan_id: null,
      applied_at: null,
      created_by: row.created_by,
      created_at: now,
    };
    this.memory.planVersions.push(version);
    return version;
  }

  async updatePlanVersionStatus(
    versionId: number,
    status: MktAiPlanVersionStatus,
  ): Promise<MktAiPlanVersionRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_plan_versions SET status = $2
         WHERE id = $1
         RETURNING id, lifecycle_id, version_no, label, status, brief_json,
                   strategy_framework_json, target_market_prof_json, campaigns_json,
                   content_json, quality_score_json, marketing_plan_id, applied_at,
                   created_by, created_at::text`,
        [versionId, status],
      );
      return res.rows[0] ? this.mapPlanVersionRow(res.rows[0]) : null;
    }
    const row = this.memory.planVersions.find((v) => v.id === versionId);
    if (!row) return null;
    row.status = status;
    return row;
  }

  async listPlanVersions(lifecycleId: number, limit = 30): Promise<MktAiPlanVersionRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, version_no, label, status, brief_json,
                strategy_framework_json, target_market_prof_json, campaigns_json,
                content_json, quality_score_json, marketing_plan_id, applied_at,
                created_by, created_at::text
         FROM mkt_ai_plan_versions
         WHERE lifecycle_id = $1
         ORDER BY version_no DESC
         LIMIT $2`,
        [lifecycleId, limit],
      );
      return res.rows.map((r) => this.mapPlanVersionRow(r));
    }
    return this.memory.planVersions
      .filter((v) => v.lifecycle_id === lifecycleId)
      .sort((a, b) => b.version_no - a.version_no)
      .slice(0, limit);
  }

  async getPlanVersion(versionId: number): Promise<MktAiPlanVersionRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, version_no, label, status, brief_json,
                strategy_framework_json, target_market_prof_json, campaigns_json,
                content_json, quality_score_json, marketing_plan_id, applied_at,
                created_by, created_at::text
         FROM mkt_ai_plan_versions WHERE id = $1`,
        [versionId],
      );
      return res.rows[0] ? this.mapPlanVersionRow(res.rows[0]) : null;
    }
    return this.memory.planVersions.find((v) => v.id === versionId) ?? null;
  }

  async listApprovals(lifecycleId: number, limit = 20): Promise<MktAiApprovalRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT a.id, a.lifecycle_id, a.plan_version_id, a.status, a.requested_by,
                a.approver_email, a.decision_note, a.requested_at::text, a.decided_at::text,
                a.created_at::text, a.updated_at::text,
                v.id AS pv_id, v.version_no, v.label AS pv_label, v.status AS pv_status
         FROM mkt_ai_approvals a
         JOIN mkt_ai_plan_versions v ON v.id = a.plan_version_id
         WHERE a.lifecycle_id = $1
         ORDER BY a.requested_at DESC
         LIMIT $2`,
        [lifecycleId, limit],
      );
      return res.rows.map((r) => this.mapApprovalRow(r));
    }
    return this.memory.approvals
      .filter((a) => a.lifecycle_id === lifecycleId)
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .slice(0, limit)
      .map((a) => {
        const pv = this.memory.planVersions.find((v) => v.id === a.plan_version_id);
        return pv ? { ...a, plan_version: pv } : a;
      });
  }

  async getLatestApproval(lifecycleId: number): Promise<MktAiApprovalRow | null> {
    const rows = await this.listApprovals(lifecycleId, 1);
    return rows[0] ?? null;
  }

  async getPendingApproval(lifecycleId: number): Promise<MktAiApprovalRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT a.id, a.lifecycle_id, a.plan_version_id, a.status, a.requested_by,
                a.approver_email, a.decision_note, a.requested_at::text, a.decided_at::text,
                a.created_at::text, a.updated_at::text,
                v.id AS pv_id, v.version_no, v.label AS pv_label, v.status AS pv_status
         FROM mkt_ai_approvals a
         JOIN mkt_ai_plan_versions v ON v.id = a.plan_version_id
         WHERE a.lifecycle_id = $1 AND a.status = 'pending'
         ORDER BY a.requested_at DESC
         LIMIT 1`,
        [lifecycleId],
      );
      return res.rows[0] ? this.mapApprovalRow(res.rows[0]) : null;
    }
    const pending = this.memory.approvals
      .filter((a) => a.lifecycle_id === lifecycleId && a.status === 'pending')
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0];
    if (!pending) return null;
    const pv = this.memory.planVersions.find((v) => v.id === pending.plan_version_id);
    return pv ? { ...pending, plan_version: pv } : pending;
  }

  async createApproval(row: {
    lifecycle_id: number;
    plan_version_id: number;
    requested_by: string;
    decision_note?: string;
  }): Promise<MktAiApprovalRow> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_approvals (
           lifecycle_id, plan_version_id, status, requested_by, decision_note,
           requested_at, created_at, updated_at
         ) VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW(), NOW())
         RETURNING id, lifecycle_id, plan_version_id, status, requested_by,
                   approver_email, decision_note, requested_at::text, decided_at::text,
                   created_at::text, updated_at::text`,
        [row.lifecycle_id, row.plan_version_id, row.requested_by, row.decision_note ?? ''],
      );
      const approval = this.mapApprovalRow(res.rows[0]);
      const pv = await this.getPlanVersion(approval.plan_version_id);
      return pv ? { ...approval, plan_version: pv } : approval;
    }
    const approval: MktAiApprovalRow = {
      id: this.memory.nextApprovalId++,
      lifecycle_id: row.lifecycle_id,
      plan_version_id: row.plan_version_id,
      status: 'pending',
      requested_by: row.requested_by,
      approver_email: null,
      decision_note: row.decision_note ?? '',
      requested_at: now,
      decided_at: null,
      created_at: now,
      updated_at: now,
    };
    this.memory.approvals.push(approval);
    const pv = this.memory.planVersions.find((v) => v.id === row.plan_version_id);
    return pv ? { ...approval, plan_version: pv } : approval;
  }

  async decideApproval(
    approvalId: number,
    patch: {
      status: MktAiApprovalStatus;
      approver_email: string;
      decision_note?: string;
    },
  ): Promise<MktAiApprovalRow | null> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_approvals SET
           status = $2,
           approver_email = $3,
           decision_note = COALESCE($4, decision_note),
           decided_at = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, plan_version_id, status, requested_by,
                   approver_email, decision_note, requested_at::text, decided_at::text,
                   created_at::text, updated_at::text`,
        [approvalId, patch.status, patch.approver_email, patch.decision_note ?? null],
      );
      if (!res.rows[0]) return null;
      const approval = this.mapApprovalRow(res.rows[0]);
      const pv = await this.getPlanVersion(approval.plan_version_id);
      return pv ? { ...approval, plan_version: pv } : approval;
    }
    const row = this.memory.approvals.find((a) => a.id === approvalId);
    if (!row) return null;
    row.status = patch.status;
    row.approver_email = patch.approver_email;
    row.decision_note = patch.decision_note ?? row.decision_note;
    row.decided_at = now;
    row.updated_at = now;
    const pv = this.memory.planVersions.find((v) => v.id === row.plan_version_id);
    return pv ? { ...row, plan_version: pv } : row;
  }

  async listComments(lifecycleId: number, planVersionId?: number, limit = 50): Promise<MktAiCommentRow[]> {
    if (await this.ensurePgReady()) {
      const clauses = ['lifecycle_id = $1'];
      const values: unknown[] = [lifecycleId];
      if (planVersionId != null) {
        clauses.push('plan_version_id = $2');
        values.push(planVersionId);
      }
      values.push(limit);
      const res = await this.db.query(
        `SELECT id, lifecycle_id, plan_version_id, approval_id, author_email, body,
                anchor_json, created_at::text, updated_at::text
         FROM mkt_ai_comments
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${values.length}`,
        values,
      );
      return res.rows.map((r) => this.mapCommentRow(r));
    }
    return this.memory.comments
      .filter(
        (c) =>
          c.lifecycle_id === lifecycleId &&
          (planVersionId == null || c.plan_version_id === planVersionId),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  async createComment(row: {
    lifecycle_id: number;
    plan_version_id: number | null;
    approval_id: number | null;
    author_email: string;
    body: string;
    anchor_json?: Record<string, unknown>;
  }): Promise<MktAiCommentRow> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_comments (
           lifecycle_id, plan_version_id, approval_id, author_email, body, anchor_json,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
         RETURNING id, lifecycle_id, plan_version_id, approval_id, author_email, body,
                   anchor_json, created_at::text, updated_at::text`,
        [
          row.lifecycle_id,
          row.plan_version_id,
          row.approval_id,
          row.author_email,
          row.body,
          JSON.stringify(row.anchor_json ?? {}),
        ],
      );
      return this.mapCommentRow(res.rows[0]);
    }
    const comment: MktAiCommentRow = {
      id: this.memory.nextCommentId++,
      lifecycle_id: row.lifecycle_id,
      plan_version_id: row.plan_version_id,
      approval_id: row.approval_id,
      author_email: row.author_email,
      body: row.body,
      anchor_json: row.anchor_json ?? {},
      created_at: now,
      updated_at: now,
    };
    this.memory.comments.push(comment);
    return comment;
  }

  private mapPlanVersionRow(r: Record<string, unknown>): MktAiPlanVersionRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      version_no: Number(r.version_no),
      label: String(r.label ?? ''),
      status: String(r.status ?? 'draft') as MktAiPlanVersionStatus,
      brief_json: (r.brief_json as MktAiBrief) ?? {},
      strategy_framework_json: (r.strategy_framework_json as Record<string, string>) ?? {},
      target_market_prof_json: (r.target_market_prof_json as Record<string, string>) ?? {},
      campaigns_json: (r.campaigns_json as MktAiDraft['campaigns_json']) ?? [],
      content_json: (r.content_json as Record<string, unknown>) ?? {},
      quality_score_json: (r.quality_score_json as Record<string, unknown>) ?? {},
      marketing_plan_id: r.marketing_plan_id != null ? Number(r.marketing_plan_id) : null,
      applied_at: r.applied_at ? String(r.applied_at) : null,
      created_by: String(r.created_by ?? ''),
      created_at: String(r.created_at ?? this.nowIso()),
    };
  }

  private mapApprovalRow(r: Record<string, unknown>): MktAiApprovalRow {
    const approval: MktAiApprovalRow = {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      plan_version_id: Number(r.plan_version_id),
      status: String(r.status ?? 'pending') as MktAiApprovalStatus,
      requested_by: String(r.requested_by ?? ''),
      approver_email: r.approver_email != null ? String(r.approver_email) : null,
      decision_note: String(r.decision_note ?? ''),
      requested_at: String(r.requested_at ?? this.nowIso()),
      decided_at: r.decided_at ? String(r.decided_at) : null,
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
    if (r.pv_id != null) {
      approval.plan_version = {
        id: Number(r.pv_id),
        lifecycle_id: approval.lifecycle_id,
        version_no: Number(r.version_no ?? 0),
        label: String(r.pv_label ?? ''),
        status: String(r.pv_status ?? 'draft') as MktAiPlanVersionStatus,
        brief_json: {},
        strategy_framework_json: {},
        target_market_prof_json: {},
        campaigns_json: [],
        content_json: {},
        quality_score_json: {},
        marketing_plan_id: null,
        applied_at: null,
        created_by: '',
        created_at: approval.requested_at,
      };
    }
    return approval;
  }

  async listStrategyScenarios(lifecycleId: number): Promise<MktAiStrategyScenarioRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_id, label, variant_slug, variant_index,
                strategy_framework_json, target_market_prof_json, swot_json,
                channel_focus_json, messaging_json, is_selected, created_at, updated_at
         FROM mkt_ai_strategy_scenarios
         WHERE lifecycle_id = $1
         ORDER BY variant_index ASC, id ASC`,
        [lifecycleId],
      );
      return res.rows.map((r) => this.mapStrategyScenarioRow(r));
    }
    return this.memory.strategyScenarios
      .filter((s) => s.lifecycle_id === lifecycleId)
      .sort((a, b) => a.variant_index - b.variant_index || a.id - b.id);
  }

  async replaceStrategyScenarios(
    lifecycleId: number,
    jobId: number,
    scenarios: Array<{
      label: string;
      variant_slug: string;
      variant_index: number;
      strategy_framework_json: Record<string, string>;
      target_market_prof_json: Record<string, string>;
      swot_json: Record<string, unknown>;
      channel_focus_json: Record<string, string>;
      messaging_json: Record<string, string>;
    }>,
  ): Promise<MktAiStrategyScenarioRow[]> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_strategy_scenarios WHERE lifecycle_id = $1`, [
        lifecycleId,
      ]);
      const rows: MktAiStrategyScenarioRow[] = [];
      for (const s of scenarios) {
        const res = await this.db.query(
          `INSERT INTO mkt_ai_strategy_scenarios (
             lifecycle_id, job_id, label, variant_slug, variant_index,
             strategy_framework_json, target_market_prof_json, swot_json,
             channel_focus_json, messaging_json, is_selected, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, FALSE, NOW(), NOW())
           RETURNING id, lifecycle_id, job_id, label, variant_slug, variant_index,
                     strategy_framework_json, target_market_prof_json, swot_json,
                     channel_focus_json, messaging_json, is_selected, created_at, updated_at`,
          [
            lifecycleId,
            jobId,
            s.label,
            s.variant_slug,
            s.variant_index,
            JSON.stringify(s.strategy_framework_json),
            JSON.stringify(s.target_market_prof_json),
            JSON.stringify(s.swot_json),
            JSON.stringify(s.channel_focus_json),
            JSON.stringify(s.messaging_json),
          ],
        );
        rows.push(this.mapStrategyScenarioRow(res.rows[0]));
      }
      return rows;
    }

    this.memory.strategyScenarios = this.memory.strategyScenarios.filter(
      (s) => s.lifecycle_id !== lifecycleId,
    );
    const now = this.nowIso();
    return scenarios.map((s) => {
      const row: MktAiStrategyScenarioRow = {
        id: this.memory.nextStrategyScenarioId++,
        lifecycle_id: lifecycleId,
        job_id: jobId,
        label: s.label,
        variant_slug: s.variant_slug,
        variant_index: s.variant_index,
        strategy_framework_json: s.strategy_framework_json,
        target_market_prof_json: s.target_market_prof_json,
        swot_json: s.swot_json,
        channel_focus_json: s.channel_focus_json,
        messaging_json: s.messaging_json,
        is_selected: false,
        created_at: now,
        updated_at: now,
      };
      this.memory.strategyScenarios.push(row);
      return row;
    });
  }

  async getStrategyScenario(
    lifecycleId: number,
    scenarioId: number,
  ): Promise<MktAiStrategyScenarioRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_id, label, variant_slug, variant_index,
                strategy_framework_json, target_market_prof_json, swot_json,
                channel_focus_json, messaging_json, is_selected, created_at, updated_at
         FROM mkt_ai_strategy_scenarios
         WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, scenarioId],
      );
      return res.rows[0] ? this.mapStrategyScenarioRow(res.rows[0]) : null;
    }
    return (
      this.memory.strategyScenarios.find(
        (s) => s.lifecycle_id === lifecycleId && s.id === scenarioId,
      ) ?? null
    );
  }

  async selectStrategyScenario(lifecycleId: number, scenarioId: number): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `UPDATE mkt_ai_strategy_scenarios SET is_selected = FALSE, updated_at = NOW()
         WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      await this.db.query(
        `UPDATE mkt_ai_strategy_scenarios SET is_selected = TRUE, updated_at = NOW()
         WHERE lifecycle_id = $1 AND id = $2`,
        [lifecycleId, scenarioId],
      );
      return;
    }
    for (const row of this.memory.strategyScenarios) {
      if (row.lifecycle_id === lifecycleId) row.is_selected = row.id === scenarioId;
    }
  }

  async listSectionComments(
    lifecycleId: number,
    sectionKey?: string,
    limit = 100,
  ): Promise<MktAiSectionCommentRow[]> {
    if (await this.ensurePgReady()) {
      const clauses = ['lifecycle_id = $1'];
      const values: unknown[] = [lifecycleId];
      if (sectionKey) {
        clauses.push('section_key = $2');
        values.push(sectionKey);
      }
      values.push(limit);
      const res = await this.db.query(
        `SELECT id, lifecycle_id, section_key, author_email, body, mention_email,
                created_at::text, updated_at::text
         FROM mkt_ai_section_comments
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at ASC
         LIMIT $${values.length}`,
        values,
      );
      return res.rows.map((r) => this.mapSectionCommentRow(r));
    }
    return this.memory.sectionComments
      .filter(
        (c) =>
          c.lifecycle_id === lifecycleId && (!sectionKey || c.section_key === sectionKey),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  async createSectionComment(row: {
    lifecycle_id: number;
    section_key: string;
    author_email: string;
    body: string;
    mention_email: string | null;
  }): Promise<MktAiSectionCommentRow> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_section_comments (
           lifecycle_id, section_key, author_email, body, mention_email, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, lifecycle_id, section_key, author_email, body, mention_email,
                   created_at::text, updated_at::text`,
        [row.lifecycle_id, row.section_key, row.author_email, row.body, row.mention_email],
      );
      return this.mapSectionCommentRow(res.rows[0]);
    }
    const comment: MktAiSectionCommentRow = {
      id: this.memory.nextSectionCommentId++,
      lifecycle_id: row.lifecycle_id,
      section_key: row.section_key,
      author_email: row.author_email,
      body: row.body,
      mention_email: row.mention_email,
      created_at: now,
      updated_at: now,
    };
    this.memory.sectionComments.push(comment);
    return comment;
  }

  private mapCommentRow(r: Record<string, unknown>): MktAiCommentRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      plan_version_id: r.plan_version_id != null ? Number(r.plan_version_id) : null,
      approval_id: r.approval_id != null ? Number(r.approval_id) : null,
      author_email: String(r.author_email ?? ''),
      body: String(r.body ?? ''),
      anchor_json: (r.anchor_json as Record<string, unknown>) ?? {},
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapStrategyScenarioRow(r: Record<string, unknown>): MktAiStrategyScenarioRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      job_id: r.job_id != null ? Number(r.job_id) : null,
      label: String(r.label ?? ''),
      variant_slug: String(r.variant_slug ?? ''),
      variant_index: Number(r.variant_index ?? 0),
      strategy_framework_json: (r.strategy_framework_json as Record<string, string>) ?? {},
      target_market_prof_json: (r.target_market_prof_json as Record<string, string>) ?? {},
      swot_json: (r.swot_json as Record<string, unknown>) ?? {},
      channel_focus_json: (r.channel_focus_json as Record<string, string>) ?? {},
      messaging_json: (r.messaging_json as Record<string, string>) ?? {},
      is_selected: Boolean(r.is_selected),
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapSectionCommentRow(r: Record<string, unknown>): MktAiSectionCommentRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      section_key: String(r.section_key ?? ''),
      author_email: String(r.author_email ?? ''),
      body: String(r.body ?? ''),
      mention_email: r.mention_email != null ? String(r.mention_email) : null,
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapJobRow(r: Record<string, unknown>): MktAiJobRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      job_type: String(r.job_type) as MktAiJobType,
      status: String(r.status) as MktAiJobStatus,
      prompt_version: String(r.prompt_version ?? 'v1'),
      model_name: String(r.model_name ?? ''),
      input_json: (r.input_json as Record<string, unknown>) ?? {},
      output_json: (r.output_json as Record<string, unknown>) ?? {},
      error_message: r.error_message != null ? String(r.error_message) : null,
      latency_ms: r.latency_ms != null ? Number(r.latency_ms) : null,
      actor_email: String(r.actor_email ?? ''),
      started_at: r.started_at ? String(r.started_at) : null,
      ended_at: r.ended_at ? String(r.ended_at) : null,
      created_at: String(r.created_at ?? this.nowIso()),
    };
  }
}
