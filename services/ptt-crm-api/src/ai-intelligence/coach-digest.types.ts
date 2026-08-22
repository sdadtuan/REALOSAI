export type CoachDigestSeverity = 'info' | 'warning' | 'critical';

export interface CoachDigestCard {
  key: 'sla' | 'sla_meta_24h' | 'ai_acceptance' | 'pipeline_risk' | 'channel_anomaly' | 'sci_win_loop';
  title: string;
  summary: string;
  severity: CoachDigestSeverity;
  metrics: Record<string, number | string | null>;
  drill_href: string;
}

export interface CoachDigestContext {
  team_id: string;
  week_key: string;
  week_label: string;
  week_start: string;
  week_end: string;
  sla_breach: number;
  sla_warning: number;
  sla_ok: number;
  sla_tier_breach?: Record<string, number>;
  sla_tier_warning?: Record<string, number>;
  top_breach_lines?: string[];
  root_cause_no_call?: number;
  root_cause_no_b2?: number;
  root_cause_no_close?: number;
  acceptance_rate_pct: number | null;
  accepted: number;
  dismissed: number;
  pending: number;
  top_dismiss_reasons: Array<{ reason: string; count: number }>;
  pipeline_at_risk: number;
  meta_open_alerts: number;
  zalo_open_alerts: number;
  cpl_spike_count: number;
  zero_leads_24h_count: number;
  roas_low_count: number;
  spend_spike_count: number;
  top_anomaly_message: string | null;
  top_anomaly_channel: 'meta' | 'zalo' | null;
  top_anomaly_campaign_id: string | null;
  sci_prep_ready?: number;
  sci_debrief_count?: number;
  sci_helpful_rate_pct?: number | null;
  sci_top_tier?: string | null;
}

export interface CoachDigestSnapshot {
  week_key: string;
  week_label: string;
  week_start: string;
  week_end: string;
  team_id: string;
  narrative: string;
  severity: CoachDigestSeverity;
  cards: CoachDigestCard[];
  email_preview: string;
}

export interface CoachDigestRecord {
  id: string;
  team_id: string;
  week_key: string;
  snapshot: CoachDigestSnapshot;
  agent_run_id: string | null;
  created_at: string;
}

export interface CoachDigestGenerateRequest {
  team_id?: string;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string;
}

export interface CoachDigestGenerateResponse {
  data: {
    created: boolean;
    skipped: boolean;
    digest: CoachDigestRecord | null;
    agent_run_id: string;
    generated_at: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface CoachDigestCurrentResponse {
  data: CoachDigestRecord | null;
  meta: { request_id: string };
  errors: unknown[];
}
