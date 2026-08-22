import {
  AlertDigestSummary,
  AnomalyDigestItem,
  AnomalyDigestSnapshot,
  ChannelAnomalyChannel,
  ChannelAnomalyCoachFields,
} from './channel-anomaly.types';
import { CoachDigestCard, CoachDigestSeverity } from './coach-digest.types';

function countByType(summary: AlertDigestSummary, type: string, channel?: ChannelAnomalyChannel): number {
  return summary.top_alerts.filter((row) => {
    if (row.alert_type !== type) return false;
    if (channel && row.channel !== channel) return false;
    return true;
  }).length;
}

export function summarizeCoachFields(summary: AlertDigestSummary): ChannelAnomalyCoachFields {
  return {
    meta_open_alerts: summary.meta_open_alerts,
    zalo_open_alerts: summary.zalo_open_alerts,
    cpl_spike_count: summary.cpl_spike_count,
    zero_leads_24h_count: summary.zero_leads_24h_count,
    roas_low_count: summary.roas_low_count,
    spend_spike_count: summary.spend_spike_count,
    top_anomaly_message: summary.top_anomaly_message,
    top_anomaly_channel: summary.top_anomaly_channel,
    top_anomaly_campaign_id: summary.top_anomaly_campaign_id,
  };
}

export function buildChannelAnomalyCard(context: ChannelAnomalyCoachFields): CoachDigestCard {
  const totalOpen = context.meta_open_alerts + context.zalo_open_alerts;
  const severity: CoachDigestSeverity =
    context.zero_leads_24h_count >= 2 || context.cpl_spike_count >= 5
      ? 'critical'
      : totalOpen >= 3 || context.cpl_spike_count > 0 || context.zero_leads_24h_count > 0
        ? 'warning'
        : 'info';

  const parts: string[] = [];
  if (context.cpl_spike_count > 0) {
    parts.push(`${context.cpl_spike_count} CPL spike`);
  }
  if (context.zero_leads_24h_count > 0) {
    parts.push(`${context.zero_leads_24h_count} zero leads 24h`);
  }
  if (context.spend_spike_count > 0) {
    parts.push(`${context.spend_spike_count} spend spike`);
  }
  if (context.roas_low_count > 0) {
    parts.push(`${context.roas_low_count} ROAS thấp`);
  }

  const summary =
    totalOpen === 0
      ? 'Không có anomaly kênh đang mở'
      : `${parts.join(' · ') || `${totalOpen} alert mở`} (Meta ${context.meta_open_alerts} · Zalo ${context.zalo_open_alerts})`;

  const drillHref =
    context.top_anomaly_channel === 'zalo'
      ? context.top_anomaly_campaign_id
        ? `/crm/leads?source=zalo&campaign=${encodeURIComponent(context.top_anomaly_campaign_id)}`
        : '/zalo/zalo-ads'
      : context.top_anomaly_campaign_id
        ? `/crm/leads?source=meta&campaign=${encodeURIComponent(context.top_anomaly_campaign_id)}`
        : '/meta/facebook-ads';

  return {
    key: 'channel_anomaly',
    title: 'Kênh quảng cáo — CPL / zero leads',
    summary,
    severity,
    metrics: {
      meta_open: context.meta_open_alerts,
      zalo_open: context.zalo_open_alerts,
      cpl_spike: context.cpl_spike_count,
      zero_leads_24h: context.zero_leads_24h_count,
      roas_low: context.roas_low_count,
      spend_spike: context.spend_spike_count,
      top_message: context.top_anomaly_message,
    },
    drill_href: drillHref,
  };
}

export function channelAnomalyNarrativeLine(context: ChannelAnomalyCoachFields): string {
  const totalOpen = context.meta_open_alerts + context.zalo_open_alerts;
  if (totalOpen === 0) {
    return 'Kênh quảng cáo không có anomaly CPL/zero leads đang mở.';
  }
  const bits: string[] = [];
  if (context.cpl_spike_count > 0) bits.push(`${context.cpl_spike_count} CPL spike`);
  if (context.zero_leads_24h_count > 0) bits.push(`${context.zero_leads_24h_count} zero leads 24h`);
  if (context.meta_open_alerts > 0) bits.push(`Meta ${context.meta_open_alerts} alert`);
  if (context.zalo_open_alerts > 0) bits.push(`Zalo ${context.zalo_open_alerts} alert`);
  return `Kênh: ${bits.join(', ')} — cần buyer review trên hub Meta/Zalo.`;
}

function mapAlertItem(row: AlertDigestSummary['top_alerts'][number]): AnomalyDigestItem {
  return {
    alert_type: row.alert_type,
    channel: row.channel === 'zalo' ? 'zalo' : 'meta',
    campaign_id: row.external_campaign_id,
    message: row.message,
    severity: row.severity,
    metric_value: row.metric_value,
  };
}

export function buildAnomalyDigestSnapshot(input: {
  summary: AlertDigestSummary;
  channel: ChannelAnomalyChannel | 'all';
  clientId?: string | null;
}): AnomalyDigestSnapshot {
  const { summary, channel, clientId } = input;
  const fields = summarizeCoachFields(summary);
  const filteredAlerts =
    channel === 'all'
      ? summary.top_alerts
      : summary.top_alerts.filter((row) => row.channel === channel);

  const anomalies = filteredAlerts.slice(0, 5).map(mapAlertItem);
  const openCount =
    channel === 'meta'
      ? fields.meta_open_alerts
      : channel === 'zalo'
        ? fields.zalo_open_alerts
        : fields.meta_open_alerts + fields.zalo_open_alerts;

  const bullets: string[] = [];
  for (const item of anomalies.slice(0, 3)) {
    bullets.push(`${item.channel === 'zalo' ? 'Zalo' : 'Meta'} · ${item.alert_type}: ${item.message}`);
  }

  let narrative: string;
  if (openCount === 0) {
    narrative =
      channel === 'zalo'
        ? 'Zalo Ads không ghi nhận anomaly CPL/zero leads đang mở trong kỳ.'
        : channel === 'meta'
          ? 'Meta Ads không ghi nhận anomaly CPL/zero leads đang mở trong kỳ.'
          : 'Không có anomaly kênh quảng cáo đang mở.';
  } else {
    const leadBits: string[] = [];
    if (fields.cpl_spike_count > 0) leadBits.push(`${fields.cpl_spike_count} CPL spike`);
    if (fields.zero_leads_24h_count > 0) leadBits.push(`${fields.zero_leads_24h_count} chiến dịch zero leads 24h`);
    if (fields.spend_spike_count > 0) leadBits.push(`${fields.spend_spike_count} spend spike`);
    narrative = `Phát hiện ${openCount} alert đang mở${clientId ? '' : ' trên toàn portfolio'}: ${leadBits.join(', ') || 'cần rà soát hub'}. Không tự động tạm dừng chiến dịch — chỉ cảnh báo read-only.`;
    if (fields.top_anomaly_message) {
      narrative += ` Nổi bật: ${fields.top_anomaly_message}`;
    }
  }

  const severity: AnomalyDigestSnapshot['severity'] =
    fields.zero_leads_24h_count >= 2 || fields.cpl_spike_count >= 5
      ? 'critical'
      : openCount >= 3 || fields.cpl_spike_count > 0 || fields.zero_leads_24h_count > 0
        ? 'warning'
        : 'info';

  const drillHref =
    channel === 'zalo'
      ? fields.top_anomaly_campaign_id
        ? `/crm/leads?source=zalo&campaign=${encodeURIComponent(fields.top_anomaly_campaign_id)}`
        : '/zalo/zalo-ads'
      : fields.top_anomaly_campaign_id
        ? `/crm/leads?source=meta&campaign=${encodeURIComponent(fields.top_anomaly_campaign_id)}`
        : '/meta/facebook-ads';

  return {
    narrative,
    bullets,
    severity,
    anomalies,
    drill_href: drillHref,
    read_only: true,
  };
}
