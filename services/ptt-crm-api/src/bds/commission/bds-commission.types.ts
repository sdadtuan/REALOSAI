export type SchemeStatus = 'draft' | 'active' | 'archived';
export type SchemeBase = 'net' | 'list';
export type TriggerStage = 'vbtt' | 'contracted' | 'handed_over';
export type LedgerStatus = 'accrued' | 'paid' | 'clawback';
export type StatementStatus = 'open' | 'locked' | 'approved' | 'paid';

export type SchemeRow = {
  id: string;
  tenant_id: string | null;
  project_id: number;
  phase_id: string | null;
  status: SchemeStatus;
  base: SchemeBase;
  currency: string;
  created_at: Date;
  updated_at: Date;
};

export type SchemeTierRow = {
  id: string;
  scheme_id: string;
  min_tier_id: string;
  product_line: string;
  pct: number;
  bonus_units_from: number | null;
  bonus_extra_pct: number;
  created_at: Date;
};

export type SplitRow = {
  id: string;
  scheme_id: string;
  trigger_stage: TriggerStage;
  pct: number;
};

export type LedgerRow = {
  id: string;
  tenant_id: string | null;
  agency_id: string;
  transaction_id: string;
  scheme_id: string | null;
  scheme_tier_id: string | null;
  trigger_stage: string;
  status: LedgerStatus;
  base_vnd: number;
  pct: number;
  amount_vnd: number;
  period_month: string | null;
  created_at: Date;
};

export type StatementRow = {
  id: string;
  tenant_id: string | null;
  agency_id: string;
  period_month: string;
  gross_vnd: number;
  advance_vnd: number;
  clawback_vnd: number;
  net_vnd: number;
  status: StatementStatus;
  created_at: Date;
  updated_at: Date;
};

export type AdvanceRow = {
  id: string;
  tenant_id: string | null;
  agency_id: string;
  amount_vnd: number;
  period_month: string;
  note: string;
  created_at: Date;
};

export type ScoreRow = {
  id: string;
  tenant_id: string | null;
  agency_id: string;
  period_month: string;
  gmv_score: number;
  units_score: number;
  total_score: number;
  from_tier_id: string | null;
  to_tier_id: string | null;
  created_at: Date;
};

export type InsertSchemeInput = {
  tenant_id?: string | null;
  project_id: number;
  phase_id?: string | null;
  base?: SchemeBase;
};

export type InsertSchemeTierInput = {
  min_tier_id: string;
  pct: number;
  product_line?: string;
};

export type InsertSplitInput = {
  trigger_stage: TriggerStage;
  pct: number;
};

export type InsertLedgerInput = {
  tenant_id?: string | null;
  agency_id: string;
  transaction_id: string;
  scheme_id?: string | null;
  scheme_tier_id?: string | null;
  trigger_stage: string;
  status?: LedgerStatus;
  base_vnd: number;
  pct: number;
  amount_vnd: number;
  period_month?: string | null;
};

export type UpsertStatementInput = {
  tenant_id?: string | null;
  agency_id: string;
  period_month: string;
  gross_vnd: number;
  advance_vnd: number;
  clawback_vnd: number;
  net_vnd: number;
  status: StatementStatus;
};

export type InsertAdvanceInput = {
  tenant_id?: string | null;
  agency_id: string;
  amount_vnd: number;
  period_month: string;
  note?: string;
};

export type InsertScoreInput = {
  tenant_id?: string | null;
  agency_id: string;
  period_month: string;
  gmv_score: number;
  units_score: number;
  total_score: number;
  from_tier_id?: string | null;
  to_tier_id?: string | null;
};

export type InsertCapiInput = {
  tenantId?: string | null;
  transactionId: string;
  leadId?: number | null;
  eventName: string;
  valueVnd?: number | null;
  status?: string;
};
