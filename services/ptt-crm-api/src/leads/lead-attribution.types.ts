export interface LeadAttributionData {
  lead_id: number;
  campaign_id: string | null;
  campaign_name: string | null;
  channel: string | null;
  client_id: string | null;
  hub_mapped: boolean;
  cpl_vnd: number | null;
  target_cpl_vnd: number | null;
  cpl_vs_target_pct: number | null;
  cpl_over_target: boolean;
  period_days: number;
  hub_href: string;
  ads_hub_href: string | null;
  ads_hub_label: string | null;
}

export interface LeadAttributionResponse {
  data: LeadAttributionData;
  meta: { request_id: string };
  errors: [];
}
