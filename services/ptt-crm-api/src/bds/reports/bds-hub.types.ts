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
  cskh_breach_15m: number;
  receipts_today_count: number;
  collected_month_vnd: number;
  hh_payable_month_vnd: number;
};

export type HubResponse = {
  tenant_id: string;
  mode: 'developer' | 'broker' | 'hybrid';
  meta_ad_mapped: boolean;
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
