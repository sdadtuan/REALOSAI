import { CskhSlaTier, CskhSlaTierSnapshot, type CskhSlaTierSummary } from './cskh-board-sla.util';
import type {
  BreachLeadSnapshot,
  BreachRootCause,
  RepPerformanceRow,
  SlaDailyDigest,
  TriageSuggestion,
} from './cskh-manager-intelligence.util';

export interface CskhBoardQuery {
  owner_id?: number;
  status?: string;
  source?: string;
  channel?: string;
  q?: string;
  sla_filter?: 'all' | 'breach' | 'warning' | 'open';
  sla_tier?: CskhSlaTier | 'all';
  spa_meta_only?: boolean;
  limit?: number;
  offset?: number;
}

export type { CskhSlaTierSummary };

export interface CskhBoardRow {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  owner_id: number | null;
  owner_name: string | null;
  received_at: string;
  created_at: string;
  first_call_at: string | null;
  b2_completed_at: string | null;
  closed_at: string | null;
  sla_state: string;
  sla_tier: CskhSlaTier | null;
  sla_tiers: CskhSlaTierSnapshot[];
  sla_minutes_elapsed: number | null;
  sla_deadline_at: string | null;
  next_follow_up_at: string | null;
}

export interface CskhBoardResponse {
  ok: boolean;
  items: CskhBoardRow[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    total: number;
    breach: number;
    warning: number;
    ok: number;
  };
  sla_dashboard: {
    tiers: Record<CskhSlaTier, CskhSlaTierSummary>;
    selected_tier: CskhSlaTier | 'all';
  };
}

export interface CskhBulkAssignBody {
  lead_ids: number[];
  to_user_id: number;
  reason: string;
}

export interface CskhBulkRescheduleBody {
  lead_ids: number[];
  follow_up_at: string;
  note?: string;
}

export interface CskhManagerIntelligenceResponse {
  ok: boolean;
  generated_at: string;
  rep_performance: RepPerformanceRow[];
  triage_suggestions: TriageSuggestion[];
  top_breaches: BreachLeadSnapshot[];
  root_cause_counts: Record<BreachRootCause, number>;
  team_ai_acceptance_pct: number | null;
  sla_daily_digest: SlaDailyDigest;
}
