import type { MetaAlertRow } from '../meta-alerts/meta-alerts.types';

export type ChannelAnomalyChannel = 'meta' | 'zalo';

export interface ChannelAnomalyCoachFields {
  meta_open_alerts: number;
  zalo_open_alerts: number;
  cpl_spike_count: number;
  zero_leads_24h_count: number;
  roas_low_count: number;
  spend_spike_count: number;
  top_anomaly_message: string | null;
  top_anomaly_channel: ChannelAnomalyChannel | null;
  top_anomaly_campaign_id: string | null;
}

export interface AlertDigestSummary extends ChannelAnomalyCoachFields {
  top_alerts: MetaAlertRow[];
}

export interface AnomalyDigestItem {
  alert_type: string;
  channel: ChannelAnomalyChannel;
  campaign_id: string | null;
  message: string;
  severity: string;
  metric_value: number | null;
}

export interface AnomalyDigestSnapshot {
  narrative: string;
  bullets: string[];
  severity: 'info' | 'warning' | 'critical';
  anomalies: AnomalyDigestItem[];
  drill_href: string;
  read_only: true;
}

export interface AnomalyDigestResponse {
  data: {
    enabled: boolean;
    client_id: string | null;
    channel: ChannelAnomalyChannel | 'all';
    days: number;
    digest: AnomalyDigestSnapshot | null;
    summary: ChannelAnomalyCoachFields;
    agent_run_id?: string | null;
    generated_at: string;
    error?: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface AnomalyDigestQuery {
  client_id?: string;
  channel?: string;
  days?: number;
  actorId?: string | null;
  correlationId?: string;
}
