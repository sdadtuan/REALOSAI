import type { NormalizedLeadPayload } from '../../webhooks/webhook-lead.types';

export type ReBuyerStatus =
  | 'moi'
  | 'da_lien_he'
  | 'xem_nha'
  | 'giu_cho'
  | 'dat_coc'
  | 'vbtt'
  | 'hdmb'
  | 'lost'
  | 'pending_cleanup';

export type SiteVisitOutcome = 'planned' | 'showed' | 'no_show' | 'cancelled';

export type BuyerRow = {
  id: string;
  tenant_id: string;
  full_name: string;
  phone_e164: string;
  email: string;
  id_number: string;
  budget_vnd: number | null;
  need_json: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type SiteVisitRow = {
  id: string;
  tenant_id: string | null;
  lead_id: number;
  product_id: number | null;
  staff_id: number;
  scheduled_at: Date;
  outcome: SiteVisitOutcome;
  note: string;
  created_at: Date;
};

export type BuyerLeadRow = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  re_project_id: number | null;
  tenant_id: string | null;
  owner_id: number | null;
  channel_partner_id: string | null;
  meta_json: Record<string, unknown>;
  created_at: string | null;
  received_at: string | null;
};

export type UpsertBuyerInput = {
  tenantId: string;
  fullName: string;
  phoneE164: string;
  email?: string;
  budgetVnd?: number | null;
  needJson?: Record<string, unknown>;
};

export type InsertVisitInput = {
  tenantId?: string;
  leadId: number;
  productId?: number | null;
  staffId: number;
  scheduledAt: Date;
  note?: string;
};

export type CreateBuyerLeadBody = {
  full_name: string;
  phone: string;
  email?: string;
  re_project_id: number;
  re_product_id?: number;
  channel?: string;
  source?: string;
  need_json?: Record<string, unknown>;
};

export type QualifyBuyerLeadBody = {
  status: string;
  budget_vnd?: number;
  need_json?: Record<string, unknown>;
};

export type CreateVisitBody = {
  scheduled_at: string;
  product_id?: number;
  staff_id: number;
  note?: string;
};

export type PreparedBuyerLead = NormalizedLeadPayload & {
  lead_flow_kind?: 're_buyer';
  b2b_project_id?: string | null;
  owner_company_id?: string | null;
  meta?: Record<string, unknown>;
};

export type MatchRow = {
  product_id: number;
  unit_code: string;
  score: number;
  list_price_vnd: number;
  bedrooms: number | null;
  direction: string;
  zone: string;
};
