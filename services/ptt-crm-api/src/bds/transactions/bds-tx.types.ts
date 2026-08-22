export type TxStage =
  | 'reservation'
  | 'deposit'
  | 'vbtt'
  | 'contracted'
  | 'handed_over'
  | 'title_issued'
  | 'cancelled'
  | 'lost';

export type TxChannel = 'inhouse' | 'agency';

export type MortgageStatus = 'none' | 'applying' | 'approved' | 'disbursed' | 'rejected';

export type TxRow = {
  id: string;
  tenant_id: string | null;
  project_id: number;
  product_id: number;
  hold_id: string | null;
  lead_id: number;
  buyer_id: string | null;
  policy_id: string | null;
  channel_partner_id: string;
  closer_staff_id: number | null;
  first_touch_staff_id: number | null;
  stage: TxStage;
  channel: TxChannel;
  list_price_vnd: number;
  net_price_vnd: number;
  discount_vnd: number;
  reservation_fee_vnd: number;
  reservation_paid_at: Date | null;
  deposit_vnd: number;
  deposit_paid_at: Date | null;
  vbtt_no: string;
  vbtt_at: Date | null;
  contract_no: string;
  contracted_at: Date | null;
  paid_pct: number;
  mortgage_status: MortgageStatus;
  handover_at: Date | null;
  title_issued_at: Date | null;
  lost_reason: string;
  created_at: Date;
  updated_at: Date;
};

export type InsertTxInput = {
  tenant_id?: string | null;
  project_id: number;
  product_id: number;
  hold_id?: string | null;
  lead_id: number;
  buyer_id?: string | null;
  policy_id?: string | null;
  channel_partner_id?: string;
  closer_staff_id?: number | null;
  first_touch_staff_id?: number | null;
  stage: TxStage;
  channel?: TxChannel;
  list_price_vnd?: number;
  net_price_vnd?: number;
  discount_vnd?: number;
  reservation_fee_vnd?: number;
  reservation_paid_at?: Date | null;
  deposit_vnd?: number;
  deposit_paid_at?: Date | null;
  vbtt_no?: string;
  vbtt_at?: Date | null;
  contract_no?: string;
  contracted_at?: Date | null;
  paid_pct?: number;
  mortgage_status?: MortgageStatus;
  handover_at?: Date | null;
  title_issued_at?: Date | null;
  lost_reason?: string;
};

export type IdempotencyRow = {
  route: string;
  key: string;
  request_hash: string;
  status_code: number;
  response_json: unknown;
  created_at: Date;
};
