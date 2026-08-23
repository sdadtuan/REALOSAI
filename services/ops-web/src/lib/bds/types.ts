export type HubInboxKind = 'hold_f1_pending' | 'hdmb_gate' | 'launch_open';

export type HubInboxRow = {
  kind: HubInboxKind;
  id: string;
  label: string;
  href: string;
};

export type HubKpi = {
  sell_through_pct: number;
  gmv_contracted_month_vnd: number;
  overdue_gt_30d: number;
  holds_expiring_2h: number;
};

export type HubResponse = {
  tenant_id: string;
  mode: 'developer' | 'broker' | 'hybrid';
  kpi: HubKpi;
  inbox: HubInboxRow[];
  sell_through_by_tower: Array<{ tower_code: string; pct: number }>;
  sell_through_by_agency: Array<{ agency_id: string; name: string; units: number }>;
};

export type LeaderboardRow = {
  agency_id: string;
  name: string;
  total_score: number;
  from_tier_id: string | null;
  to_tier_id: string | null;
};

export type BdsHoldStatus = 'pending' | 'active' | 'cancelled' | 'expired' | 'converted' | 'rejected';

export type BdsHoldRow = {
  id: string;
  project_id: number;
  product_id: number;
  lead_id: number;
  channel_partner_id: string;
  status: BdsHoldStatus;
  expires_at: string | null;
  note: string;
  approved_by: string;
};

export type BdsTxRow = {
  id: string;
  project_id: number;
  product_id: number;
  hold_id: string | null;
  stage: string;
  net_price_vnd: number;
  paid_pct: number;
  row_version?: number;
};

export type BdsHdmbGate = {
  legal: { ready: boolean };
  paid_pct: number;
  hdmb_min_paid_pct: number;
  paid_ready: boolean;
  ready: boolean;
};

export type BdsBuyerRow = {
  id: number;
  full_name: string;
  phone?: string;
  status: string;
  re_project_id: number | null;
  received_at: string | null;
};

export type BdsAgingRow = {
  transaction_id: string;
  installment_id: string;
  milestone_code: string;
  due_date: string;
  amount_vnd: number;
  paid_vnd: number;
  overdue_days: number;
  bucket: string;
};
