import type { PerformanceChannel } from '../performance/performance.types';
import type { MetaDataFreshness } from '../meta-attribution.util';

export interface PortalReportChannelKpi {
  channel: PerformanceChannel;
  spend: number;
  leads_crm: number;
  avg_cpl: number | null;
}

export interface PortalReportSummaryPeriod {
  from: string;
  to: string;
  label: string;
  days: number;
}

export interface PortalReportSummaryKpis {
  total_spend: number;
  total_leads_crm: number;
  avg_cpl: number | null;
  avg_roas: number | null;
  campaigns_tracked: number;
  over_target_rows: number;
  unmapped_spend_pct: number;
}

export interface PortalReportSummaryInput {
  client_id: string;
  period: PortalReportSummaryPeriod;
  kpis: PortalReportSummaryKpis;
  channels: PortalReportChannelKpi[];
  data_freshness?: MetaDataFreshness | null;
}

export interface PortalReportSummarySnapshot {
  narrative: string;
  bullets: string[];
}

export interface PortalAiReportSummaryResponse {
  ok: boolean;
  client_id: string;
  enabled: boolean;
  period: PortalReportSummaryPeriod;
  narrative: string;
  bullets: string[];
  kpis: PortalReportSummaryKpis;
  channels: PortalReportChannelKpi[];
  data_freshness?: MetaDataFreshness | null;
  generated_at: string;
  stub_mode: boolean;
  agent_run_id?: string | null;
  error?: string;
}
