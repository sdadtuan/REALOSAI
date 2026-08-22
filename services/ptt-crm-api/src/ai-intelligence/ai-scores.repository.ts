import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  AiScoreRecord,
  LeadScoreExplainability,
  LEAD_SCORE_IDEMPOTENCY_MINUTES,
  LEAD_SCORE_MODEL,
  LEAD_SCORE_MODEL_VERSION,
  LEAD_SCORE_OVERRIDE_MODEL,
} from './lead-score.types';

function mapScoreRow(row: Record<string, unknown>): AiScoreRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    entity_type: String(row.entity_type ?? ''),
    entity_id: String(row.entity_id ?? ''),
    score_type: String(row.score_type ?? ''),
    score_value: Number(row.score_value ?? 0),
    confidence: row.confidence != null ? Number(row.confidence) : null,
    features_json: (row.features_json as Record<string, unknown>) ?? {},
    explainability_json: (row.explainability_json as AiScoreRecord['explainability_json']) ?? {
      factors: [],
      flags: [],
      score_band: 'cold',
    },
    model_name: (row.model_name as string | null) ?? null,
    model_version: String(row.model_version ?? LEAD_SCORE_MODEL_VERSION),
    agent_run_id: (row.agent_run_id as string | null) ?? null,
    overridden_by: (row.overridden_by as string | null) ?? null,
    overridden_at: row.overridden_at != null ? String(row.overridden_at) : null,
    override_reason: (row.override_reason as string | null) ?? null,
    calculated_at: String(row.calculated_at ?? ''),
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class AiScoresRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_scores'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async findRecentAutoScore(
    entityType: string,
    entityId: string,
    scoreType = 'lead',
    windowMinutes = LEAD_SCORE_IDEMPOTENCY_MINUTES,
  ): Promise<AiScoreRecord | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, score_type, score_value,
         confidence, features_json, explainability_json, model_name, model_version,
         agent_run_id::text, overridden_by, overridden_at::text, override_reason,
         calculated_at::text, created_at::text
       FROM ai_scores
       WHERE entity_type = $1
         AND entity_id = $2
         AND score_type = $3
         AND overridden_by IS NULL
         AND calculated_at >= NOW() - ($4::text || ' minutes')::interval
       ORDER BY calculated_at DESC
       LIMIT 1`,
      [entityType, entityId, scoreType, String(windowMinutes)],
    );
    const row = result.rows[0];
    return row ? mapScoreRow(row as Record<string, unknown>) : null;
  }

  async insertOverrideScore(input: {
    clientId?: string | null;
    entityType: string;
    entityId: string;
    scoreType: string;
    scoreValue: number;
    confidence: number;
    features: Record<string, unknown>;
    explainability: LeadScoreExplainability;
    agentRunId?: string | null;
    overriddenBy: string;
    overrideReason: string;
  }): Promise<AiScoreRecord> {
    const result = await this.db.query(
      `INSERT INTO ai_scores (
         client_id, entity_type, entity_id, score_type, score_value, confidence,
         features_json, explainability_json, model_name, model_version, agent_run_id,
         overridden_by, overridden_at, override_reason
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6,
         $7::jsonb, $8::jsonb, $9, $10, $11::uuid,
         $12, NOW(), $13
       )
       RETURNING
         id::text, client_id::text, entity_type, entity_id, score_type, score_value,
         confidence, features_json, explainability_json, model_name, model_version,
         agent_run_id::text, overridden_by, overridden_at::text, override_reason,
         calculated_at::text, created_at::text`,
      [
        input.clientId ?? null,
        input.entityType,
        input.entityId,
        input.scoreType,
        input.scoreValue,
        input.confidence,
        JSON.stringify(input.features),
        JSON.stringify(input.explainability),
        LEAD_SCORE_OVERRIDE_MODEL,
        LEAD_SCORE_MODEL_VERSION,
        input.agentRunId ?? null,
        input.overriddenBy,
        input.overrideReason,
      ],
    );
    return mapScoreRow(result.rows[0] as Record<string, unknown>);
  }

  async insertScore(input: {
    clientId?: string | null;
    entityType: string;
    entityId: string;
    scoreType: string;
    scoreValue: number;
    confidence: number;
    features: Record<string, unknown>;
    explainability: LeadScoreExplainability;
    agentRunId?: string | null;
    modelName?: string;
    modelVersion?: string;
  }): Promise<AiScoreRecord> {
    const result = await this.db.query(
      `INSERT INTO ai_scores (
         client_id, entity_type, entity_id, score_type, score_value, confidence,
         features_json, explainability_json, model_name, model_version, agent_run_id
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6,
         $7::jsonb, $8::jsonb, $9, $10, $11::uuid
       )
       RETURNING
         id::text, client_id::text, entity_type, entity_id, score_type, score_value,
         confidence, features_json, explainability_json, model_name, model_version,
         agent_run_id::text, overridden_by, overridden_at::text, override_reason,
         calculated_at::text, created_at::text`,
      [
        input.clientId ?? null,
        input.entityType,
        input.entityId,
        input.scoreType,
        input.scoreValue,
        input.confidence,
        JSON.stringify(input.features),
        JSON.stringify(input.explainability),
        input.modelName ?? LEAD_SCORE_MODEL,
        input.modelVersion ?? LEAD_SCORE_MODEL_VERSION,
        input.agentRunId ?? null,
      ],
    );
    return mapScoreRow(result.rows[0] as Record<string, unknown>);
  }

  async deleteById(id: string): Promise<void> {
    await this.db.query('DELETE FROM ai_scores WHERE id = $1::uuid', [id]);
  }

  async listScores(
    entityType: string,
    entityId: string,
    limit = 10,
  ): Promise<AiScoreRecord[]> {
    const lim = Math.min(Math.max(limit, 1), 50);
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, score_type, score_value,
         confidence, features_json, explainability_json, model_name, model_version,
         agent_run_id::text, overridden_by, overridden_at::text, override_reason,
         calculated_at::text, created_at::text
       FROM ai_scores
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY calculated_at DESC
       LIMIT $3`,
      [entityType, entityId, lim],
    );
    return result.rows.map((row) => mapScoreRow(row as Record<string, unknown>));
  }

  async getLatest(entityType: string, entityId: string): Promise<AiScoreRecord | null> {
    const rows = await this.listScores(entityType, entityId, 1);
    return rows[0] ?? null;
  }

  /** UI-R1-10 — latest score per entity for leads list column. */
  async listLatestForEntities(entityType: string, entityIds: string[]): Promise<AiScoreRecord[]> {
    const ids = [...new Set(entityIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) {
      return [];
    }
    const capped = ids.slice(0, 50);
    const result = await this.db.query(
      `SELECT DISTINCT ON (entity_id)
         id::text, client_id::text, entity_type, entity_id, score_type, score_value,
         confidence, features_json, explainability_json, model_name, model_version,
         agent_run_id::text, overridden_by, overridden_at::text, override_reason,
         calculated_at::text, created_at::text
       FROM ai_scores
       WHERE entity_type = $1 AND entity_id = ANY($2::text[])
       ORDER BY entity_id, calculated_at DESC`,
      [entityType, capped],
    );
    return result.rows.map((row) => mapScoreRow(row as Record<string, unknown>));
  }
}
