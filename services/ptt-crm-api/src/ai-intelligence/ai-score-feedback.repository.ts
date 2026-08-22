import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type ScoreFeedbackOutcome = 'chot' | 'lost' | 'stalled';

export interface ScoreFeedbackAggregate {
  override_count: number;
  avg_override_score: number | null;
  outcome_chot: number;
  outcome_lost: number;
  outcome_stalled: number;
}

@Injectable()
export class AiScoreFeedbackRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ai_score_feedback'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async insertOverride(input: {
    leadId: number;
    staffId: string;
    overrideScore: number;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO ai_score_feedback (lead_id, staff_id, override_score)
       VALUES ($1, $2, $3)`,
      [input.leadId, input.staffId, input.overrideScore],
    );
  }

  async backfillOutcome(leadId: number, outcome: ScoreFeedbackOutcome): Promise<number> {
    const result = await this.db.query(
      `UPDATE ai_score_feedback
       SET outcome = $2
       WHERE lead_id = $1 AND outcome IS NULL`,
      [leadId, outcome],
    );
    return result.rowCount ?? 0;
  }

  async insertOutcomeRows(leadId: number, outcome: ScoreFeedbackOutcome): Promise<void> {
    await this.db.query(
      `INSERT INTO ai_score_feedback (lead_id, staff_id, outcome)
       SELECT $1, 'system:outcome', $2
       WHERE NOT EXISTS (
         SELECT 1 FROM ai_score_feedback
         WHERE lead_id = $1 AND outcome = $2
       )`,
      [leadId, outcome],
    );
  }

  async aggregateForLead(leadId: number): Promise<ScoreFeedbackAggregate> {
    const result = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE override_score IS NOT NULL)::int AS override_count,
         AVG(override_score) FILTER (WHERE override_score IS NOT NULL) AS avg_override_score,
         COUNT(*) FILTER (WHERE outcome = 'chot')::int AS outcome_chot,
         COUNT(*) FILTER (WHERE outcome = 'lost')::int AS outcome_lost,
         COUNT(*) FILTER (WHERE outcome = 'stalled')::int AS outcome_stalled
       FROM ai_score_feedback
       WHERE lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0] ?? {};
    return {
      override_count: Number(row.override_count ?? 0),
      avg_override_score:
        row.avg_override_score != null ? Math.round(Number(row.avg_override_score) * 10) / 10 : null,
      outcome_chot: Number(row.outcome_chot ?? 0),
      outcome_lost: Number(row.outcome_lost ?? 0),
      outcome_stalled: Number(row.outcome_stalled ?? 0),
    };
  }
}
