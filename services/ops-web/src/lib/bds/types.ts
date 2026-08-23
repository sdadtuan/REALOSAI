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

export type BdsLegalDoc = {
  id: string;
  doc_type: string;
  status: string;
  file_id?: string;
  issued_on?: string | null;
  expires_on?: string | null;
};

export type BdsTower = { id: string; code: string; name: string };

export type BdsPhase = { id: string; code: string; name: string; status: string };

export type BdsMilestone = {
  id: string;
  code: string;
  name: string;
  status: string;
  target_date?: string | null;
  actual_date?: string | null;
};

export type BdsPlanRevision = { id: string; kind: string; version: number; status: string };

export type BdsPolicy = {
  id: string;
  code: string;
  name: string;
  status: string;
  project_id: number;
  hdmb_min_paid_pct?: number;
};

export type BdsPriceList = { id: number; version_code: string; name?: string };

export type BdsAgency = {
  id: string;
  code: string;
  name: string;
  status: string;
  kind?: string;
  tier_id?: string | null;
};

export type BdsBasketUnit = { product_id: number; exclusivity?: string };

export type BdsUnit = {
  id: number;
  unit_code: string;
  tower?: string;
  floor?: string;
  status?: string;
  pool?: string;
  row_version?: number;
};

export type BdsStack = {
  project_id: number;
  towers: Array<{ tower: string; floors: Array<{ floor: string; units: BdsUnit[] }> }>;
};

export type BdsImportResult = {
  imported: number;
  skipped_sold: Array<{ unit_code: string; reason: string }>;
  conflicts: Array<{ unit_code: string; error: string }>;
};
