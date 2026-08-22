import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { AiAgentRunsRepository } from '../ai-agent-runs.repository';
import {
  AiOrchestrationChildRunInsert,
  AiOrchestrationInsert,
  AiOrchestrationRecord,
  AiOrchestrationRow,
  AiOrchestrationStatus,
  AiOrchestrationTriggerType,
  OrchestratorListQuery,
  OrchestratorListResult,
  ORCHESTRATOR_MIGRATION_VERSION,
} from './orchestrator.types';
import { AiAgentRunRecord, AiAgentRunRow } from '../ai-intelligence.types';

function mapOrchestrationRow(row: Record<string, unknown>): AiOrchestrationRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    trigger_type: row.trigger_type as AiOrchestrationTriggerType,
    trigger_ref: (row.trigger_ref as string | null) ?? null,
    plan_key: String(row.plan_key ?? ''),
    status: row.status as AiOrchestrationStatus,
    input_json: (row.input_json as Record<string, unknown>) ?? {},
    output_json: (row.output_json as Record<string, unknown>) ?? {},
    correlation_id: (row.correlation_id as string | null) ?? null,
    actor_id: (row.actor_id as string | null) ?? null,
    started_at: String(row.started_at ?? ''),
    ended_at: row.ended_at != null ? String(row.ended_at) : null,
    created_at: String(row.created_at ?? ''),
  };
}

const ORCHESTRATION_SELECT_COLUMNS = `
  id::text, client_id::text, trigger_type, trigger_ref, plan_key, status,
  input_json, output_json, correlation_id, actor_id,
  started_at::text, ended_at::text, created_at::text
`;

@Injectable()
export class OrchestratorRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly runs: AiAgentRunsRepository,
  ) {}

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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_orchestrations'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async migrationVersion(): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT version FROM schema_migrations
         WHERE version = $1
         LIMIT 1`,
        [ORCHESTRATOR_MIGRATION_VERSION],
      );
      return (result.rows[0]?.version as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async create(row: AiOrchestrationInsert): Promise<AiOrchestrationRow> {
    const result = await this.db.query(
      `INSERT INTO ai_orchestrations (
         client_id, trigger_type, trigger_ref, plan_key, status,
         input_json, output_json, correlation_id, actor_id
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         $6::jsonb, $7::jsonb, $8, $9
       )
       RETURNING id::text AS id`,
      [
        row.clientId ?? null,
        row.triggerType,
        row.triggerRef ?? null,
        row.planKey,
        row.status ?? 'running',
        JSON.stringify(row.inputJson ?? {}),
        JSON.stringify(row.outputJson ?? {}),
        row.correlationId ?? null,
        row.actorId ?? null,
      ],
    );
    return { id: String(result.rows[0]?.id ?? '') };
  }

  async getOrchestration(id: string): Promise<AiOrchestrationRecord | null> {
    const result = await this.db.query(
      `SELECT ${ORCHESTRATION_SELECT_COLUMNS}
       FROM ai_orchestrations
       WHERE id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapOrchestrationRow(row) : null;
  }

  async updateStatus(
    id: string,
    status: AiOrchestrationStatus,
    outputJson: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.query(
      `UPDATE ai_orchestrations
       SET status = $2,
           output_json = $3::jsonb,
           ended_at = CASE
             WHEN $2::varchar IN ('succeeded', 'failed', 'cancelled') THEN NOW()
             ELSE ended_at
           END
       WHERE id = $1::uuid`,
      [id, status, JSON.stringify(outputJson)],
    );
  }

  async list(query: OrchestratorListQuery = {}): Promise<OrchestratorListResult> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    if (query.from) {
      conditions.push(`started_at >= $${idx++}::timestamptz`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`started_at <= $${idx++}::timestamptz`);
      params.push(query.to);
    }
    if (query.planKey) {
      conditions.push(`plan_key ILIKE $${idx++}`);
      params.push(`%${query.planKey}%`);
    }
    if (query.status) {
      conditions.push(`status = $${idx++}`);
      params.push(query.status);
    }

    const where = conditions.join(' AND ');
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM ai_orchestrations WHERE ${where}`,
      params,
    );
    const listParams = [...params, limit, offset];
    const result = await this.db.query(
      `SELECT ${ORCHESTRATION_SELECT_COLUMNS}
       FROM ai_orchestrations
       WHERE ${where}
       ORDER BY started_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      listParams,
    );
    return {
      rows: result.rows.map(mapOrchestrationRow),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async insertChildRun(row: AiOrchestrationChildRunInsert): Promise<AiAgentRunRow> {
    return this.runs.insertChildRun(row);
  }

  async listChildren(parentRunId: string): Promise<AiAgentRunRecord[]> {
    return this.runs.listChildren(parentRunId);
  }
}
