export type PaymentTemplateRow = {
  code: string;
  pct: number;
  due_days_from_deposit: number;
};

export type AgingBucket = '0_15' | '16_30' | '31_60' | '60_plus';

export type ScheduleRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  project_id: number;
  policy_id: string | null;
  source: 'deposit' | 'vbtt' | 'manual';
  created_at: Date;
};

export type InstallmentRow = {
  id: string;
  tenant_id: string | null;
  schedule_id: string;
  transaction_id: string;
  seq: number;
  milestone_code: string;
  due_date: Date;
  amount_vnd: number;
  paid_vnd: number;
  status: 'due' | 'partial' | 'paid' | 'overdue' | 'waived';
  overdue_days: number;
  created_at: Date;
  updated_at: Date;
};

export type ReceiptRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  installment_id: string | null;
  receipt_no: string;
  amount_vnd: number;
  paid_at: Date;
  method: 'bank' | 'cash' | 'loan';
  note: string;
  created_by: string;
  created_at: Date;
};

export type MortgageRow = {
  id: string;
  tenant_id: string | null;
  transaction_id: string;
  bank_name: string;
  amount_vnd: number;
  status: 'applying' | 'approved' | 'disbursed' | 'rejected';
  file_id: string;
  note: string;
  created_at: Date;
  updated_at: Date;
};

export type AgingRow = {
  transaction_id: string;
  installment_id: string;
  installment_seq: number;
  milestone_code: string;
  due_date: Date;
  amount_vnd: number;
  paid_vnd: number;
  overdue_days: number;
  bucket: AgingBucket;
  build_milestone_code: string | null;
  build_milestone_name: string | null;
  build_milestone_status: string | null;
  build_milestone_target_date: string | null;
};

export type HdmbGateLegalStatus = {
  so_xd: boolean;
  bao_lanh: boolean;
  giai_chap: boolean;
  mau_hdmb: boolean;
  ready: boolean;
};

export type HdmbGateStatus = {
  legal: HdmbGateLegalStatus;
  paid_pct: number;
  hdmb_min_paid_pct: number;
  paid_ready: boolean;
  ready: boolean;
};

export type CreateReceiptBody = {
  transaction_id: string;
  installment_id?: string;
  receipt_no?: string;
  amount_vnd: number;
  paid_at?: string;
  method: 'bank' | 'cash' | 'loan';
  note?: string;
  created_by?: string;
};

export type UpsertMortgageBody = {
  bank_name?: string;
  amount_vnd?: number;
  status?: 'applying' | 'approved' | 'disbursed' | 'rejected';
  file_id?: string;
  note?: string;
};

export type AssertContractOpts = {
  tenantId?: string;
  buyerWaiveGuarantee?: boolean;
  waiveFileId?: string;
};
