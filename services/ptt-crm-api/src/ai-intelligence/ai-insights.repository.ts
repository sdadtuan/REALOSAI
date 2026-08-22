import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CoachDigestSnapshot } from './coach-digest.types';

export const MANAGER_COACH_INSIGHT_TYPE = 'manager_coach_weekly';

export interface AiInsightRecord {
  id: string;
  client_id: string | null;
  entity_type: string;
  entity_id: string;
  insight_type: string;
  title: string;
  description: string;
  confidence: number | null;
  severity: string;
  status: string;
  created_by_model: string | null;
  agent_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): AiInsightRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    entity_type: String(row.entity_type ?? ''),
    entity_id: String(row.entity_id ?? ''),
    insight_type: String(row.insight_type ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    confidence: row.confidence != null ? Number(row.confidence) : null,
    severity: String(row.severity ?? 'info'),
    status: String(row.status ?? 'open'),
    created_by_model: (row.created_by_model as string | null) ?? null,
    agent_run_id: (row.agent_run_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

@Injectable()
export class AiInsightsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ai_insights'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async findCoachDigestForWeek(teamId: string, weekKey: string): Promise<AiInsightRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM ai_insights
       WHERE entity_type = 'team'
         AND entity_id = $1
         AND insight_type = $2
         AND metadata->>'week_key' = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [teamId, MANAGER_COACH_INSIGHT_TYPE, weekKey],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async findLatestCoachDigest(teamId: string): Promise<AiInsightRecord | null> {
    const result = await this.db.query(
      `SELECT * FROM ai_insights
       WHERE entity_type = 'team'
         AND entity_id = $1
         AND insight_type = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [teamId, MANAGER_COACH_INSIGHT_TYPE],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async insertCoachDigest(args: {
    teamId: string;
    snapshot: CoachDigestSnapshot;
    agentRunId?: string | null;
  }): Promise<AiInsightRecord> {
    const result = await this.db.query(
      `INSERT INTO ai_insights (
         entity_type, entity_id, insight_type, title, description,
         severity, status, created_by_model, agent_run_id, metadata
       ) VALUES (
         'team', $1, $2, $3, $4,
         $5, 'open', 'manager-coach-v1', $6::uuid, $7::jsonb
       )
       RETURNING *`,
      [
        args.teamId,
        MANAGER_COACH_INSIGHT_TYPE,
        `Coach digest ${args.snapshot.week_label}`,
        args.snapshot.narrative,
        args.snapshot.severity,
        args.agentRunId ?? null,
        JSON.stringify({
          week_key: args.snapshot.week_key,
          week_label: args.snapshot.week_label,
          week_start: args.snapshot.week_start,
          week_end: args.snapshot.week_end,
          team_id: args.snapshot.team_id,
          cards: args.snapshot.cards,
          email_preview: args.snapshot.email_preview,
        }),
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async updateCoachDigestDelivery(
    digestId: string,
    delivery: { email_status: 'sent' | 'skipped' | 'failed'; email_sent_at?: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE ai_insights
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1::uuid AND insight_type = $3`,
      [digestId, JSON.stringify(delivery), MANAGER_COACH_INSIGHT_TYPE],
    );
  }
}
