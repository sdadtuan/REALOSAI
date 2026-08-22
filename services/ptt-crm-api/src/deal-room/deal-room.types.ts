import type { ProposalAdvanceGate } from '../leads-funnel/presales-proposal-gate.util';
import type { PresalesSnapshot } from '../leads-funnel/leads-funnel.types';

export interface DealRoomGateChip {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'block' | 'pending';
  message: string;
}

export interface DealRoomGates {
  g0_b2: DealRoomGateChip;
  g1_consult: DealRoomGateChip;
  g4_r5: DealRoomGateChip;
  g5_proposal: DealRoomGateChip;
  g6_accept: DealRoomGateChip;
}

export interface DealRoomMarketingPlanView {
  name: string;
  north_star: string;
  objectives: string;
  strategy_framework: Record<string, string>;
  validation_ok: boolean;
  validation_messages: string[];
}

export interface L1GateChecklistItemView {
  key: string;
  label: string;
  done: boolean;
}

export interface DealRoomQuoteTierView {
  tier: string;
  tier_label: string;
  total_vnd: number | null;
  reference_min_vnd: number | null;
  reference_max_vnd: number | null;
  is_reference: boolean;
}

export interface SciRedFlagBlockView {
  active: boolean;
  reason: string;
  flags: Array<{ flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string }>;
}

export interface DealRoomQuoteView {
  proposal_id: number | null;
  status: string | null;
  total_vnd: number | null;
  customer_id: number | null;
  presales_id: number | null;
  service_slug: string;
  tiers: DealRoomQuoteTierView[];
  can_create: boolean;
  block_reason: string;
  sci_red_flag_block: SciRedFlagBlockView;
}

export interface DealRoomActionsView {
  can_export_pack: boolean;
  can_share_teaser: boolean;
  proposals_href: string;
  teaser: {
    active: boolean;
    url: string | null;
    expires_at: string | null;
  };
}

export interface DealRoomSciSlice {
  available: boolean;
  prep_stage: string | null;
  close_readiness_score: number | null;
  opening_narrative_vi: string;
  slide_bullets_vi: string[];
  recommended_close_ask_vi: string;
  offer_ladder_summary: Array<{
    tier: string;
    sku_code: string;
    label_vi: string;
    anchor_role: string;
    price_hint_vnd: number | null;
  }>;
  red_flags: Array<{ flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string }>;
  playbook_slug: string | null;
  playbook_label_vi: string | null;
  href_prep: string;
}

export interface DealRoomSnapshot {
  ok: true;
  lead_id: number;
  lead_name: string;
  lead_flow_kind: string;
  owner_id: number | null;
  owner_name: string | null;
  presales: PresalesSnapshot;
  gates: DealRoomGates;
  marketing_plan: DealRoomMarketingPlanView;
  consult_progress: { done: number; total: number };
  quote: DealRoomQuoteView;
  actions: DealRoomActionsView;
  proposal_gate: ProposalAdvanceGate;
  l1_checklist: L1GateChecklistItemView[];
  sci: DealRoomSciSlice;
}
