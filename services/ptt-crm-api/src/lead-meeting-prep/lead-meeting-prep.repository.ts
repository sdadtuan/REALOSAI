import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  LeadMeetingPrepRow,
  LeadMeetingPrepStage,
  LeadMeetingPrepStatus,
  LeadPrepContextRow,
} from './lead-meeting-prep.types';

function parseJsonCol<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

@Injectable()
export class LeadMeetingPrepRepository implements OnModuleDestroy {
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
    const result = await this.db.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'crm_lead_meeting_prep'`,
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getLeadContext(leadId: number): Promise<LeadPrepContextRow | null> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id,
              l.full_name, l.phone, l.email, l.status, l.source, l.channel,
              l.agency_client_id::text AS client_id,
              l.is_duplicate,
              COALESCE(l.meta_json, '{}'::jsonb) AS meta_json
       FROM crm_leads l
       WHERE l.sqlite_lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      lead_id: Number(row.lead_id),
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      source: row.source,
      channel: row.channel,
      client_id: row.client_id,
      is_duplicate: row.is_duplicate,
      meta_json: parseJsonCol<Record<string, unknown>>(row.meta_json, {}),
    };
  }

  async getByLeadId(leadId: number): Promise<LeadMeetingPrepRow | null> {
    const result = await this.db.query(
      `SELECT id, lead_id, status, skip_reason,
              input_snapshot_json, collect_json, entity_candidates_json,
              selected_entity_id, result_json, error_message,
              prep_version, synth_version, tavily_credits_used, apify_runs,
              prep_stage, close_readiness_score, win_outcome_json,
              ai_agent_run_id::text AS ai_agent_run_id,
              created_at::text AS created_at, updated_at::text AS updated_at
       FROM crm_lead_meeting_prep
       WHERE lead_id = $1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  async ensurePrepRow(
    leadId: number,
    inputSnapshot: Record<string, unknown> = {},
  ): Promise<LeadMeetingPrepRow> {
    const existing = await this.getByLeadId(leadId);
    if (existing) return existing;

    await this.db.query(
      `INSERT INTO crm_lead_meeting_prep (lead_id, status, input_snapshot_json)
       VALUES ($1, 'skipped', $2::jsonb)
       ON CONFLICT (lead_id) DO NOTHING`,
      [leadId, JSON.stringify(inputSnapshot)],
    );

    const row = await this.getByLeadId(leadId);
    if (!row) {
      throw new Error(`ensurePrepRow failed for lead ${leadId}`);
    }
    return row;
  }

  async upsertPending(input: {
    leadId: number;
    prepStage: LeadMeetingPrepStage;
    inputSnapshot: Record<string, unknown>;
    selectedEntityId?: string | null;
  }): Promise<LeadMeetingPrepRow> {
    const result = await this.db.query(
      `INSERT INTO crm_lead_meeting_prep (
         lead_id, status, prep_stage, input_snapshot_json, selected_entity_id
       ) VALUES ($1, 'pending', $2, $3::jsonb, $4)
       ON CONFLICT (lead_id) DO UPDATE SET
         status = CASE
           WHEN crm_lead_meeting_prep.status IN ('running', 'awaiting_entity_choice')
             AND EXCLUDED.status = 'pending' THEN crm_lead_meeting_prep.status
           ELSE 'pending'
         END,
         prep_stage = EXCLUDED.prep_stage,
         input_snapshot_json = EXCLUDED.input_snapshot_json,
         selected_entity_id = COALESCE(EXCLUDED.selected_entity_id, crm_lead_meeting_prep.selected_entity_id),
         error_message = NULL,
         updated_at = NOW()
       RETURNING id, lead_id, status, skip_reason,
                 input_snapshot_json, collect_json, entity_candidates_json,
                 selected_entity_id, result_json, error_message,
                 prep_version, synth_version, tavily_credits_used, apify_runs,
                 prep_stage, close_readiness_score, win_outcome_json,
                 ai_agent_run_id::text AS ai_agent_run_id,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [
        input.leadId,
        input.prepStage,
        JSON.stringify(input.inputSnapshot),
        input.selectedEntityId ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async markSkipped(leadId: number, skipReason: string, inputSnapshot: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_lead_meeting_prep (lead_id, status, skip_reason, input_snapshot_json)
       VALUES ($1, 'skipped', $2, $3::jsonb)
       ON CONFLICT (lead_id) DO UPDATE SET
         status = 'skipped',
         skip_reason = EXCLUDED.skip_reason,
         input_snapshot_json = EXCLUDED.input_snapshot_json,
         updated_at = NOW()`,
      [leadId, skipReason, JSON.stringify(inputSnapshot)],
    );
  }

  async insertFeedback(input: {
    leadId: number;
    prepId: number;
    helpful: boolean;
    notes?: string | null;
    serviceDvCode?: string | null;
    actorEmail: string;
  }): Promise<{ id: number }> {
    const result = await this.db.query(
      `INSERT INTO crm_lead_meeting_prep_feedback
         (lead_id, prep_id, helpful, notes, service_dv_code, actor_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.leadId,
        input.prepId,
        input.helpful,
        input.notes ?? null,
        input.serviceDvCode ?? null,
        input.actorEmail,
      ],
    );
    return { id: Number(result.rows[0]?.id ?? 0) };
  }

  async updateWinOutcome(leadId: number, winOutcome: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_lead_meeting_prep (lead_id, status, prep_stage, win_outcome_json)
       VALUES ($1, 'ready', 'm4_learn', $2::jsonb)
       ON CONFLICT (lead_id) DO UPDATE SET
         win_outcome_json = EXCLUDED.win_outcome_json,
         prep_stage = 'm4_learn',
         updated_at = NOW()`,
      [leadId, JSON.stringify(winOutcome)],
    );
  }

  async aggregateSciMetrics(windowDays: number) {
    const days = Math.max(1, Math.min(windowDays, 90));
    const result = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE p.status = 'ready') AS prep_ready_count,
         COUNT(*) FILTER (WHERE p.status IN ('pending', 'running')) AS prep_running_count,
         COUNT(*) FILTER (
           WHERE COALESCE(p.win_outcome_json->>'submitted_at', '') <> ''
         ) AS debrief_submitted_count,
         COUNT(*) FILTER (
           WHERE COALESCE(p.win_outcome_json->>'submitted_at', '') <> ''
             AND COALESCE(p.win_outcome_json->>'outcome', '') = 'won'
         ) AS chot_with_sci_count,
         AVG(p.close_readiness_score) FILTER (WHERE p.close_readiness_score IS NOT NULL) AS avg_close_readiness,
         COUNT(*) FILTER (
           WHERE p.win_outcome_json->>'sci_helpful' = 'true'
         ) AS sci_helpful_yes,
         COUNT(*) FILTER (
           WHERE p.win_outcome_json->>'sci_helpful' IN ('true', 'false')
         ) AS sci_helpful_total
       FROM crm_lead_meeting_prep p
       WHERE p.updated_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [days],
    );

    const tierResult = await this.db.query(
      `SELECT COALESCE(p.win_outcome_json->>'closed_tier', 'unknown') AS tier, COUNT(*)::int AS cnt
       FROM crm_lead_meeting_prep p
       WHERE p.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND COALESCE(p.win_outcome_json->>'submitted_at', '') <> ''
       GROUP BY 1`,
      [days],
    );

    const objectionResult = await this.db.query(
      `SELECT TRIM(COALESCE(p.win_outcome_json->>'objection_faced', '')) AS objection,
              COUNT(*)::int AS cnt
       FROM crm_lead_meeting_prep p
       WHERE p.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
         AND TRIM(COALESCE(p.win_outcome_json->>'objection_faced', '')) <> ''
       GROUP BY 1
       ORDER BY cnt DESC
       LIMIT 5`,
      [days],
    );

    const row = result.rows[0] as Record<string, unknown>;
    const tierMix = { CB: 0, TC: 0, CS: 0, unknown: 0 };
    for (const tr of tierResult.rows) {
      const tier = String((tr as { tier?: string }).tier ?? 'unknown').toUpperCase();
      const cnt = Number((tr as { cnt?: number }).cnt ?? 0);
      if (tier === 'CB' || tier === 'TC' || tier === 'CS') {
        tierMix[tier] = cnt;
      } else {
        tierMix.unknown += cnt;
      }
    }

    const helpfulYes = Number(row.sci_helpful_yes ?? 0);
    const helpfulTotal = Number(row.sci_helpful_total ?? 0);
    const helpfulRate =
      helpfulTotal > 0 ? Math.round((helpfulYes / helpfulTotal) * 1000) / 10 : null;

    return {
      window_days: days,
      prep_ready_count: Number(row.prep_ready_count ?? 0),
      prep_running_count: Number(row.prep_running_count ?? 0),
      debrief_submitted_count: Number(row.debrief_submitted_count ?? 0),
      chot_with_sci_count: Number(row.chot_with_sci_count ?? 0),
      tier_mix: tierMix,
      avg_close_readiness:
        row.avg_close_readiness != null ? Math.round(Number(row.avg_close_readiness)) : null,
      helpful_rate_pct: helpfulRate,
      top_objections: objectionResult.rows.map((r) => ({
        objection: String((r as { objection?: string }).objection ?? ''),
        count: Number((r as { cnt?: number }).cnt ?? 0),
      })),
    };
  }

  private mapRow(row: Record<string, unknown>): LeadMeetingPrepRow {
    return {
      id: Number(row.id),
      lead_id: Number(row.lead_id),
      status: String(row.status) as LeadMeetingPrepStatus,
      skip_reason: row.skip_reason != null ? String(row.skip_reason) : null,
      input_snapshot_json: parseJsonCol(row.input_snapshot_json, {}),
      collect_json: parseJsonCol(row.collect_json, {}),
      entity_candidates_json: parseJsonCol(row.entity_candidates_json, []),
      selected_entity_id: row.selected_entity_id != null ? String(row.selected_entity_id) : null,
      result_json: parseJsonCol(row.result_json, {}),
      error_message: row.error_message != null ? String(row.error_message) : null,
      prep_version: Number(row.prep_version ?? 1),
      synth_version: Number(row.synth_version ?? 1),
      tavily_credits_used: Number(row.tavily_credits_used ?? 0),
      apify_runs: Number(row.apify_runs ?? 0),
      prep_stage: String(row.prep_stage ?? 'm1_first_strike') as LeadMeetingPrepStage,
      close_readiness_score:
        row.close_readiness_score != null ? Number(row.close_readiness_score) : null,
      win_outcome_json: parseJsonCol(row.win_outcome_json, {}),
      ai_agent_run_id: row.ai_agent_run_id != null ? String(row.ai_agent_run_id) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}
