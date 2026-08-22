import type { GtmStatus } from './gtm-status.util';
import type { Industry, PublicDemoBody, PublicDemoLocale, SkuInterest } from './gtm-validate.util';
import type { SlaTone } from './gtm-sla.util';

export type GtmDemoRequestRow = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: PublicDemoLocale;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  industry: Industry;
  sku_interest: SkuInterest;
  company_size: string | null;
  message: string | null;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  status: GtmStatus;
  status_note: string | null;
  owner_user_id: string | null;
  lead_id: string | null;
  sandbox_expires_at: string | null;
  sandbox_user_id: string | null;
  ip_hash: string;
  market_country: string | null;
};

export type GtmDemoRequestView = GtmDemoRequestRow & {
  sla_tone: SlaTone;
  sla_deadline_local: string | null;
  sla_timezone_label: string | null;
};

export type GtmUtmFields = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export type InsertGtmDemoInput = PublicDemoBody &
  GtmUtmFields & {
    ip_hash: string;
    lead_id: string | null;
    owner_user_id: string | null;
  };

export type ListGtmDemoQuery = {
  status?: GtmStatus;
  industry?: Industry;
  locale?: PublicDemoLocale;
  market_country?: string;
  owner_user_id?: string;
  limit?: number;
  offset?: number;
};

export type PatchGtmDemoBody = {
  status?: GtmStatus;
  status_note?: string | null;
  owner_user_id?: string | null;
  sandbox_user_id?: string | null;
  sandbox_expires_at?: Date | string | null;
};

export type GrantGtmSandboxPatch = {
  sandbox_expires_at: Date;
  sandbox_user_id: string;
  status: 'sandbox_granted';
};

export type CreatePublicDemoResult = {
  id: string;
  lead_id: string;
  deduped: boolean;
};

export type CreatePublicDemoResponse =
  | CreatePublicDemoResult
  | 'honeypot'
  | 'rate_limited'
  | { field_errors: Record<string, string> };
