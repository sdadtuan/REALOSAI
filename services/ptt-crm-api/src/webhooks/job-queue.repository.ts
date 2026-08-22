import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { NormalizedLeadPayload } from './webhook-lead.types';

export interface EnqueuedJob {
  id: string;
  job_type: string;
  status: string;
  idempotency_key: string;
  correlation_id: string | null;
  created: boolean;
}

export interface EnqueueIngestResult {
  mode: 'queue' | 'none';
  jobs: EnqueuedJob[];
}

@Injectable()
export class JobQueueRepository implements OnModuleDestroy {
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

  async enqueueIngestLeads(
    leads: NormalizedLeadPayload[],
    opts: { channel: string; correlationId?: string; clientId?: string },
  ): Promise<EnqueueIngestResult> {
    if (!leads.length) {
      return { mode: 'none', jobs: [] };
    }
    if (!this.config.jobsEnabled || !this.config.webhookEnqueueEnabled) {
      throw new Error('Job queue disabled (PTT_JOBS_ENABLED or PTT_WEBHOOK_V1_ENQUEUE=0)');
    }

    const jobs: EnqueuedJob[] = [];
    for (const lead of leads) {
      const channel = opts.channel;
      const extId = String(lead.external_lead_id ?? lead.idempotency_key ?? '');
      const idem = String(lead.idempotency_key || `ingest:${channel}:${extId}`);
      const payload = {
        lead,
        channel,
        client_id: opts.clientId || lead.client_id || '',
        b2b_project_id: (lead as { b2b_project_id?: string }).b2b_project_id ?? null,
        owner_company_id: (lead as { owner_company_id?: string }).owner_company_id ?? null,
        lead_flow_kind: (lead as { lead_flow_kind?: string }).lead_flow_kind ?? null,
      };
      const clientId = this.normalizeClientUuid(opts.clientId || lead.client_id);
      jobs.push(
        await this.enqueueJobRecord({
          jobType: 'ingest_lead',
          payload,
          idempotencyKey: idem,
          correlationId: opts.correlationId,
          clientId,
        }),
      );
    }
    return { mode: 'queue', jobs };
  }

  private normalizeClientUuid(clientId: string | undefined): string | null {
    const text = String(clientId ?? '').trim();
    if (!text || text === 'unknown') return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
      return text.toLowerCase();
    }
    return null;
  }

  /** S-LMP-1 — async lead meeting prep (AI-UC-021). */
  async enqueueLeadMeetingPrepJob(input: {
    leadId: number;
    clientId?: string | null;
    correlationId?: string;
    prepStage?: string;
    mode?: string;
    selectedEntityId?: string | null;
    idempotencyKey?: string;
    terminalStatus?: 'chot' | 'lost';
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    const leadId = Number(input.leadId);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return null;
    }
    const idem =
      input.idempotencyKey?.trim() || `lead_meeting_prep:lead:${leadId}`;
    return this.enqueueJobRecord({
      jobType: 'lead_meeting_prep',
      payload: {
        lead_id: leadId,
        client_id: input.clientId ?? null,
        prep_stage: input.prepStage ?? 'm1_first_strike',
        mode: input.mode ?? 'full',
        selected_entity_id: input.selectedEntityId ?? null,
        terminal_status: input.terminalStatus ?? null,
      },
      idempotencyKey: idem,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 3,
    });
  }

  /** M4 — async market-research desk Tavily collect. */
  async enqueueResearchDeskJob(input: {
    projectId: number;
    questionId: number;
    runId: number;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_desk_collect',
      payload: {
        project_id: input.projectId,
        question_id: input.questionId,
        run_id: input.runId,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** P2 M2 — async competitor snapshot pulse + optional Tavily. */
  async enqueueResearchPulseJob(input: {
    projectId: number;
    questionId?: number | null;
    runId: number;
    clientId?: string | null;
    lifecycleId?: number | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_pulse',
      payload: {
        project_id: input.projectId,
        question_id: input.questionId ?? null,
        run_id: input.runId,
        lifecycle_id: input.lifecycleId ?? null,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** P5 M1 — async Whisper ingest; payload has temp_path, never transcript. */
  async enqueueResearchWhisperJob(input: {
    projectId: number;
    studyId: number;
    runId: number;
    tempPath: string;
    mime?: string | null;
    questionId?: number | null;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_whisper_ingest',
      payload: {
        project_id: input.projectId,
        study_id: input.studyId,
        run_id: input.runId,
        temp_path: input.tempPath,
        mime: input.mime ?? null,
        question_id: input.questionId ?? null,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** P10 — async Qualtrics survey response export → codebook evidence. */
  async enqueueResearchQualtricsJob(input: {
    projectId: number;
    studyId: number;
    runId: number;
    columnMap: Record<string, unknown>;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_qualtrics',
      payload: {
        project_id: input.projectId,
        study_id: input.studyId,
        run_id: input.runId,
        column_map: input.columnMap,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** P13 — async RAG OpenAI re-embed backfill for stale corpus embeddings. */
  async enqueueResearchRagReembedJob(input: {
    projectId: number;
    runId: number;
    clientId?: string | null;
    allowedClientIds?: string[] | null;
    limit: number;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_rag_reembed',
      payload: {
        project_id: input.projectId,
        run_id: input.runId,
        client_id: input.clientId ?? null,
        allowed_client_ids: input.allowedClientIds ?? null,
        limit: input.limit,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** P5 M3 — async SparkToro audience source candidates. */
  async enqueueResearchSparktoroJob(input: {
    projectId: number;
    questionId: number;
    runId: number;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_sparktoro',
      payload: {
        project_id: input.projectId,
        question_id: input.questionId,
        run_id: input.runId,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** M6 — async dual Tavily triangulation (basic + advanced). */
  async enqueueResearchTriangulateJob(input: {
    projectId: number;
    questionId: number;
    runId: number;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_triangulate',
      payload: {
        project_id: input.projectId,
        question_id: input.questionId,
        run_id: input.runId,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** M5 — async market-research deep research (Tavily advanced fallback). */
  async enqueueResearchDeepJob(input: {
    projectId: number;
    questionId: number;
    runId: number;
    clientId?: string | null;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) return null;
    return this.enqueueJobRecord({
      jobType: 'research_deep_research',
      payload: {
        project_id: input.projectId,
        question_id: input.questionId,
        run_id: input.runId,
      },
      idempotencyKey: input.idempotencyKey,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 2,
    });
  }

  /** RNOS-08 — async lead score consumer (AI-UC-001). */
  async enqueueScoreLeadJob(input: {
    leadId: number;
    clientId?: string | null;
    correlationId?: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    const leadId = Number(input.leadId);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: 'score_lead',
      payload: {
        lead_id: leadId,
        client_id: input.clientId ?? null,
      },
      idempotencyKey: `score_lead:lead:${leadId}`,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId ?? undefined),
      maxAttempts: 3,
    });
  }

  private async enqueueJobRecord(input: {
    jobType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    correlationId?: string;
    clientId: string | null;
    maxAttempts?: number;
  }): Promise<EnqueuedJob> {
    const maxAttempts = input.maxAttempts ?? 5;
    const insert = await this.db.query(
      `INSERT INTO job_queue (
         job_type, payload, idempotency_key, correlation_id, client_id, max_attempts, status
       ) VALUES ($1, $2::jsonb, $3, $4, $5::uuid, $6, 'pending')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, job_type, status, idempotency_key, correlation_id`,
      [
        input.jobType,
        JSON.stringify(input.payload),
        input.idempotencyKey,
        input.correlationId ?? null,
        input.clientId,
        maxAttempts,
      ],
    );
    if (insert.rows[0]) {
      const row = insert.rows[0] as {
        id: string;
        job_type: string;
        status: string;
        idempotency_key: string;
        correlation_id: string | null;
      };
      return {
        id: String(row.id),
        job_type: row.job_type,
        status: row.status,
        idempotency_key: row.idempotency_key,
        correlation_id: row.correlation_id,
        created: true,
      };
    }
    const existing = await this.db.query(
      `SELECT id, job_type, status, idempotency_key, correlation_id
       FROM job_queue WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    const row = existing.rows[0] as {
      id: string;
      job_type: string;
      status: string;
      idempotency_key: string;
      correlation_id: string | null;
    };
    return {
      id: String(row.id),
      job_type: row.job_type,
      status: row.status,
      idempotency_key: row.idempotency_key,
      correlation_id: row.correlation_id,
      created: false,
    };
  }

  async enqueueEmailJob(input: {
    jobType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    correlationId?: string;
    clientId: string;
  }): Promise<EnqueuedJob> {
    if (!this.config.jobsEnabled || !this.config.webhookEnqueueEnabled) {
      throw new Error('Job queue disabled (PTT_JOBS_ENABLED or PTT_WEBHOOK_V1_ENQUEUE=0)');
    }
    return this.enqueueJobRecord({
      jobType: input.jobType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId),
    });
  }

  /** Agency ops jobs (activate, token connect, manual sync) — only requires PTT_JOBS_ENABLED. */
  async enqueueAgencyJob(input: {
    jobType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    clientId: string;
    correlationId?: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: input.jobType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId),
    });
  }

  /** B9 CAPI replay/retry — only requires PTT_JOBS_ENABLED. */
  async enqueueCapiDispatch(input: {
    payload: Record<string, unknown>;
    idempotencyKey: string;
    clientId: string;
    correlationId?: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: 'capi_dispatch',
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId),
    });
  }

  async enqueueMetaConversionEval(input: {
    payload: Record<string, unknown>;
    idempotencyKey: string;
    clientId: string;
    correlationId?: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: 'meta_conversion_eval',
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      clientId: this.normalizeClientUuid(input.clientId),
    });
  }

  /** SEO/AEO sync jobs (GSC, GA4) — customer_id in payload. */
  async enqueueSeoSyncJob(input: {
    jobType: 'seo_gsc_sync' | 'seo_ga4_sync';
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: input.jobType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      clientId: null,
    });
  }

  /** AEO batch scan — customer_id + optional query_ids in payload. */
  async enqueueSeoAeoScanJob(input: {
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: 'seo_aeo_scan',
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      clientId: null,
    });
  }

  /** SEO daily facts → ClickHouse (Gate D / Phase 6). */
  async enqueueSeoClickhouseExportJob(input: {
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EnqueuedJob | null> {
    if (!this.config.jobsEnabled) {
      return null;
    }
    return this.enqueueJobRecord({
      jobType: 'seo_clickhouse_export',
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      clientId: null,
    });
  }

  async cancelPendingJobsForClient(clientId: string): Promise<number> {
    if (!this.config.jobsEnabled) {
      return 0;
    }
    const normalized = this.normalizeClientUuid(clientId);
    if (!normalized) {
      return 0;
    }
    const result = await this.db.query(
      `UPDATE job_queue
       SET status = 'dead',
           last_error = 'cancelled:client_offboarded',
           finished_at = NOW(),
           updated_at = NOW()
       WHERE client_id = $1::uuid
         AND status = 'pending'`,
      [normalized],
    );
    return result.rowCount ?? 0;
  }
}
