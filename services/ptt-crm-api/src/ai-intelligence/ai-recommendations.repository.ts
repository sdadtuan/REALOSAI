import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  AiRecommendationRecord,
  RecommendationStatus,
} from './recommendation.types';
import type {
  AcceptanceByTypeRow,
  AiAcceptanceMetrics,
  DismissReasonRow,
} from './feedback-analytics.types';

function mapRow(row: Record<string, unknown>): AiRecommendationRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    entity_type: String(row.entity_type ?? ''),
    entity_id: String(row.entity_id ?? ''),
    recommendation_type: String(row.recommendation_type ?? ''),
    recommendation_text: String(row.recommendation_text ?? ''),
    action_json: (row.action_json as Record<string, unknown>) ?? {},
    confidence: row.confidence != null ? Number(row.confidence) : null,
    status: String(row.status ?? 'pending') as RecommendationStatus,
    dismissed_reason: (row.dismissed_reason as string | null) ?? null,
    accepted_by: (row.accepted_by as string | null) ?? null,
    accepted_at: row.accepted_at != null ? String(row.accepted_at) : null,
    agent_run_id: (row.agent_run_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

@Injectable()
export class AiRecommendationsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ai_recommendations'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async insert(args: {
    entityType: string;
    entityId: string;
    recommendationType: string;
    text: string;
    actionJson: Record<string, unknown>;
    confidence: number | null;
    agentRunId: string | null;
    clientId?: string | null;
  }): Promise<AiRecommendationRecord> {
    const result = await this.db.query(
      `INSERT INTO ai_recommendations (
         client_id, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, agent_run_id
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6::jsonb, $7, 'pending', $8::uuid
       )
       RETURNING
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text`,
      [
        args.clientId ?? null,
        args.entityType,
        args.entityId,
        args.recommendationType,
        args.text,
        JSON.stringify(args.actionJson ?? {}),
        args.confidence,
        args.agentRunId,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    status?: RecommendationStatus,
    limit = 10,
  ): Promise<AiRecommendationRecord[]> {
    const capped = Math.min(Math.max(limit, 1), 50);
    const select = `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE entity_type = $1 AND entity_id = $2`;
    if (status) {
      const result = await this.db.query(
        `${select} AND status = $3 ORDER BY created_at DESC LIMIT $4`,
        [entityType, entityId, status, capped],
      );
      return result.rows.map((row) => mapRow(row as Record<string, unknown>));
    }
    const result = await this.db.query(`${select} ORDER BY created_at DESC LIMIT $3`, [
      entityType,
      entityId,
      capped,
    ]);
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async findRecentPendingByType(
    entityType: string,
    entityId: string,
    recommendationType: string,
    withinHours = 24,
  ): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE entity_type = $1
         AND entity_id = $2
         AND recommendation_type = $3
         AND status = 'pending'
         AND created_at >= NOW() - ($4::text || ' hours')::interval
       ORDER BY created_at DESC
       LIMIT 1`,
      [entityType, entityId, recommendationType, String(withinHours)],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async listPendingByType(
    recommendationType: string,
    limit = 50,
    offset = 0,
  ): Promise<{ rows: AiRecommendationRecord[]; total: number }> {
    const capped = Math.min(Math.max(limit, 1), 200);
    const off = Math.max(offset, 0);
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total
       FROM ai_recommendations
       WHERE recommendation_type = $1 AND status = 'pending'`,
      [recommendationType],
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE recommendation_type = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [recommendationType, capped, off],
    );
    return {
      rows: result.rows.map((row) => mapRow(row as Record<string, unknown>)),
      total,
    };
  }

  async dismissPendingByTypeForEntity(
    entityType: string,
    entityId: string,
    recommendationType: string,
    reason: string,
  ): Promise<number> {
    const result = await this.db.query(
      `UPDATE ai_recommendations
       SET status = 'dismissed',
           dismissed_reason = $4,
           updated_at = NOW()
       WHERE entity_type = $1
         AND entity_id = $2
         AND recommendation_type = $3
         AND status = 'pending'`,
      [entityType, entityId, recommendationType, reason.slice(0, 120)],
    );
    return result.rowCount ?? 0;
  }

  async mergeActionJson(id: string, patch: Record<string, unknown>): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `UPDATE ai_recommendations
       SET action_json = COALESCE(action_json, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text`,
      [id, JSON.stringify(patch ?? {})],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async listByTypeForEntity(
    recommendationType: string,
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<AiRecommendationRecord[]> {
    const capped = Math.min(Math.max(limit, 1), 100);
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE recommendation_type = $1
         AND entity_type = $2
         AND entity_id = $3
       ORDER BY created_at DESC
       LIMIT $4`,
      [recommendationType, entityType, entityId, capped],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async latestScanTimestamp(recommendationType: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT MAX(created_at)::text AS scanned_at
       FROM ai_recommendations
       WHERE recommendation_type = $1`,
      [recommendationType],
    );
    return (result.rows[0]?.scanned_at as string | undefined) ?? null;
  }

  async updateStatus(args: {
    id: string;
    status: RecommendationStatus;
    recommendationText?: string;
    acceptedBy?: string | null;
    dismissedReason?: string | null;
  }): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `UPDATE ai_recommendations
       SET status = $2::varchar,
           recommendation_text = COALESCE($3, recommendation_text),
           accepted_by = CASE WHEN $2::varchar = 'accepted' THEN $4 ELSE accepted_by END,
           accepted_at = CASE WHEN $2::varchar = 'accepted' THEN NOW() ELSE accepted_at END,
           dismissed_reason = CASE WHEN $2::varchar = 'dismissed' THEN $5 ELSE dismissed_reason END,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text`,
      [
        args.id,
        args.status,
        args.recommendationText ?? null,
        args.acceptedBy ?? null,
        args.dismissedReason ?? null,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async getAcceptanceMetrics(args: {
    from: string;
    to: string;
    recommendationType?: string;
  }): Promise<Omit<AiAcceptanceMetrics, 'from' | 'to'>> {
    const params: unknown[] = [args.from, args.to];
    let typeFilter = '';
    if (args.recommendationType) {
      params.push(args.recommendationType);
      typeFilter = ` AND recommendation_type = $3`;
    }

    const summaryResult = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
         COUNT(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM ai_recommendations
       WHERE created_at >= $1::timestamptz
         AND created_at <= $2::timestamptz
         ${typeFilter}`,
      params,
    );
    const summary = summaryResult.rows[0] as {
      accepted: number;
      dismissed: number;
      pending: number;
    };
    const accepted = Number(summary.accepted ?? 0);
    const dismissed = Number(summary.dismissed ?? 0);
    const pending = Number(summary.pending ?? 0);
    const totalResolved = accepted + dismissed;
    const acceptanceRatePct =
      totalResolved > 0 ? Math.round((accepted / totalResolved) * 1000) / 10 : null;

    const byTypeResult = await this.db.query(
      `SELECT
         recommendation_type,
         COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
         COUNT(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM ai_recommendations
       WHERE created_at >= $1::timestamptz
         AND created_at <= $2::timestamptz
         ${typeFilter}
       GROUP BY recommendation_type
       ORDER BY recommendation_type`,
      params,
    );
    const byType: AcceptanceByTypeRow[] = byTypeResult.rows.map((row) => ({
      recommendation_type: String(row.recommendation_type ?? ''),
      accepted: Number(row.accepted ?? 0),
      dismissed: Number(row.dismissed ?? 0),
      pending: Number(row.pending ?? 0),
    }));

    const reasonResult = await this.db.query(
      `SELECT
         COALESCE(NULLIF(TRIM(dismissed_reason), ''), 'unknown') AS reason,
         COUNT(*)::int AS count
       FROM ai_recommendations
       WHERE status = 'dismissed'
         AND created_at >= $1::timestamptz
         AND created_at <= $2::timestamptz
         ${typeFilter}
       GROUP BY 1
       ORDER BY count DESC, reason ASC
       LIMIT 8`,
      params,
    );
    const topDismissReasons: DismissReasonRow[] = reasonResult.rows.map((row) => ({
      reason: String(row.reason ?? 'unknown'),
      count: Number(row.count ?? 0),
    }));

    return {
      acceptance_rate_pct: acceptanceRatePct,
      accepted,
      dismissed,
      pending,
      total_resolved: totalResolved,
      by_type: byType,
      top_dismiss_reasons: topDismissReasons,
    };
  }

  async listRecent(args: {
    status?: RecommendationStatus;
    from: string;
    to: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: AiRecommendationRecord[]; total: number }> {
    const limit = Math.min(Math.max(Number(args.limit ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(args.offset ?? 0) || 0, 0);
    const params: unknown[] = [args.from, args.to];
    const where = [
      'created_at >= $1::timestamptz',
      'created_at <= $2::timestamptz',
    ];
    if (args.status) {
      params.push(args.status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.join(' AND ');
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM ai_recommendations WHERE ${whereSql}`,
      params,
    );
    const total = Number((countResult.rows[0] as { n: number }).n ?? 0);

    params.push(limit, offset);
    const listResult = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE ${whereSql}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: listResult.rows.map((row) => mapRow(row as Record<string, unknown>)),
      total,
    };
  }
}
