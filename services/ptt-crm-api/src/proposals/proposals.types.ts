export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export const PROPOSAL_STATUS_FLOW: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent', 'rejected'],
  sent: ['accepted', 'rejected', 'draft'],
  accepted: [],
  rejected: ['draft'],
};

export interface ProposalRow {
  id: number;
  customer_id: number;
  lead_id: number | null;
  presales_id: number | null;
  lifecycle_id: number | null;
  service_slugs: string[];
  total_vnd: number;
  timeline_months: number;
  notes: string;
  ai_output: Record<string, unknown>;
  generated?: boolean;
  status: ProposalStatus;
  valid_until: string | null;
  price_adjustment_reason: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItemRow {
  id: number;
  proposal_id: number;
  dv_code: string;
  sku_code: string | null;
  package_tier: string;
  service_slug: string;
  reference_price_min: number;
  reference_price_max: number;
  final_price_vnd: number;
  scope_notes: string;
  lifecycle_id: number | null;
  sort_order: number;
}

export interface QuoteLineInput {
  dv_code?: string;
  sku_code?: string;
  package_tier?: string;
  final_price_vnd?: number;
  scope_notes?: string;
}

export interface CreateProposalBody {
  customer_id?: number;
  lead_id?: number;
  presales_id?: number;
  service_slug?: string;
  package_tier?: string;
  auto_lines?: boolean;
  service_slugs?: string[];
  lines?: QuoteLineInput[];
  total_vnd?: number;
  timeline_months?: number;
  notes?: string;
  lifecycle_id?: number | null;
  valid_until?: string | null;
}

export interface PatchProposalStatusBody {
  status: ProposalStatus;
  price_adjustment_reason?: string;
  spawn_week?: boolean;
}

export interface PutQuoteLinesBody {
  lines: QuoteLineInput[];
  price_adjustment_reason?: string;
}
