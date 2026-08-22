import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { LeadScoreExplainability } from '../ai-intelligence/lead-score.types';
import type { B2bSlaState } from './b2b-lead-list.util';
import { computeB2bSlaState, isB2bInHoursNow } from './b2b-lead-list.util';

export interface B2bIntelligenceLeadContext {
  received_at: string | null;
  score: number | null;
  sla_state: B2bSlaState;
  has_note: boolean;
  has_meeting: boolean;
}

@Injectable()
export class B2bIntelligenceRepository implements OnModuleDestroy {
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

  async loadLatestScore(leadId: number): Promise<{
    score_value: number;
    explainability_json: LeadScoreExplainability;
  } | null> {
    try {
      const result = await this.db.query(
        `SELECT score_value, explainability_json
         FROM ai_scores
         WHERE entity_type = 'lead' AND entity_id = $1
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [String(leadId)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        score_value: Number(row.score_value ?? 0),
        explainability_json: (row.explainability_json as LeadScoreExplainability) ?? {
          factors: [],
          flags: [],
          score_band: 'cold',
        },
      };
    } catch {
      return null;
    }
  }

  async loadLeadContext(leadId: number, hasCall: boolean): Promise<B2bIntelligenceLeadContext | null> {
    const leadResult = await this.db.query(
      `SELECT
         COALESCE(l.received_at::text, l.created_at::text) AS received_at,
         NULLIF(l.meta_json->>'lead_score', '') AS meta_score
       FROM crm_leads l
       WHERE l.sqlite_lead_id = $1
       LIMIT 1`,
      [leadId],
    );
    const lead = leadResult.rows[0];
    if (!lead) return null;

    const activityResult = await this.db.query(
      `SELECT lower(COALESCE(activity_type, '')) AS activity_type
       FROM crm_lead_activities
       WHERE lead_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [leadId],
    );

    const metaScoreRaw = lead.meta_score != null ? Number(lead.meta_score) : null;
    const score = Number.isFinite(metaScoreRaw) ? metaScoreRaw : null;
    const receivedAt = lead.received_at != null ? String(lead.received_at) : null;
    const assignedDt = receivedAt ? new Date(receivedAt) : null;
    const elapsedMin =
      assignedDt && !Number.isNaN(assignedDt.getTime())
        ? Math.max(0, (Date.now() - assignedDt.getTime()) / 60_000)
        : 0;

    const hasNote = activityResult.rows.some((row) => String(row.activity_type) === 'note');
    const hasMeeting = activityResult.rows.some((row) => String(row.activity_type) === 'meeting');

    return {
      received_at: receivedAt,
      score,
      sla_state: computeB2bSlaState({
        score,
        elapsedMin,
        hasCallActivity: hasCall,
        answered: false,
        inHours: isB2bInHoursNow(),
      }),
      has_note: hasNote,
      has_meeting: hasMeeting,
    };
  }
}
