import {
  buildChannelAnomalyCard,
  channelAnomalyNarrativeLine,
} from './channel-anomaly.engine';
import {
  CoachDigestCard,
  CoachDigestContext,
  CoachDigestSeverity,
  CoachDigestSnapshot,
} from './coach-digest.types';

export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekWindow(date = new Date()): { week_start: string; week_end: string; week_label: string } {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    week_start: fmt(start),
    week_end: fmt(end),
    week_label: `${fmt(start)} → ${fmt(end)}`,
  };
}

function worstSeverity(cards: CoachDigestCard[]): CoachDigestSeverity {
  if (cards.some((c) => c.severity === 'critical')) return 'critical';
  if (cards.some((c) => c.severity === 'warning')) return 'warning';
  return 'info';
}

export function buildCoachDigest(context: CoachDigestContext): CoachDigestSnapshot {
  const cards: CoachDigestCard[] = [];

  const slaSeverity: CoachDigestSeverity =
    context.sla_breach >= 5 ? 'critical' : context.sla_breach > 0 || context.sla_warning >= 3 ? 'warning' : 'info';
  cards.push({
    key: 'sla',
    title: 'SLA gọi lead đầu tiên',
    summary:
      context.sla_breach > 0
        ? `${context.sla_breach} lead vi phạm SLA · ${context.sla_warning} cảnh báo`
        : `Không vi phạm SLA · ${context.sla_ok} đúng hạn`,
    severity: slaSeverity,
    metrics: {
      breach: context.sla_breach,
      warning: context.sla_warning,
      ok: context.sla_ok,
    },
    drill_href: '/crm/cskh-board?sla_filter=breach',
  });

  const tierBreach = context.sla_tier_breach ?? {};
  const tierWarning = context.sla_tier_warning ?? {};
  const meta24Severity: CoachDigestSeverity =
    (tierBreach.first_call_15m ?? 0) >= 3 ||
    (tierBreach.b2_complete_4h ?? 0) >= 3 ||
    (tierBreach.close_24h ?? 0) >= 3
      ? 'critical'
      : Object.values(tierBreach).some((v) => (v ?? 0) > 0)
        ? 'warning'
        : 'info';
  const topLines = context.top_breach_lines ?? [];
  cards.push({
    key: 'sla_meta_24h',
    title: 'SLA Spa Meta 24h (3 tier)',
    summary:
      topLines.length > 0
        ? `Top breach: ${topLines.slice(0, 2).join(' · ')}`
        : `15p ${tierBreach.first_call_15m ?? 0} · 4h ${tierBreach.b2_complete_4h ?? 0} · 24h ${tierBreach.close_24h ?? 0} breach`,
    severity: meta24Severity,
    metrics: {
      breach_15m: tierBreach.first_call_15m ?? 0,
      breach_4h: tierBreach.b2_complete_4h ?? 0,
      breach_24h: tierBreach.close_24h ?? 0,
      warn_15m: tierWarning.first_call_15m ?? 0,
      warn_4h: tierWarning.b2_complete_4h ?? 0,
      warn_24h: tierWarning.close_24h ?? 0,
      root_no_call: context.root_cause_no_call ?? 0,
      root_no_b2: context.root_cause_no_b2 ?? 0,
      root_no_close: context.root_cause_no_close ?? 0,
    },
    drill_href: '/crm/cskh-board?sla_filter=breach',
  });

  const rate = context.acceptance_rate_pct;
  const aiSeverity: CoachDigestSeverity =
    rate == null ? 'info' : rate < 20 ? 'critical' : rate < 35 ? 'warning' : 'info';
  const topReason = context.top_dismiss_reasons[0];
  cards.push({
    key: 'ai_acceptance',
    title: 'AI acceptance (7 ngày)',
    summary:
      rate == null
        ? 'Chưa đủ dữ liệu feedback AI'
        : `Tỷ lệ chấp nhận ${rate}% · ${context.dismissed} bỏ / ${context.accepted} chấp nhận`,
    severity: aiSeverity,
    metrics: {
      acceptance_rate_pct: rate,
      accepted: context.accepted,
      dismissed: context.dismissed,
      pending: context.pending,
      top_dismiss_reason: topReason?.reason ?? null,
      top_dismiss_count: topReason?.count ?? 0,
    },
    drill_href: '/crm/ai/insights?status=dismissed',
  });

  const pipelineSeverity: CoachDigestSeverity =
    context.pipeline_at_risk >= 10 ? 'critical' : context.pipeline_at_risk >= 3 ? 'warning' : 'info';
  cards.push({
    key: 'pipeline_risk',
    title: 'Pipeline at-risk',
    summary:
      context.pipeline_at_risk > 0
        ? `${context.pipeline_at_risk} deal đang at-risk (stalled)`
        : 'Không có deal at-risk đang mở',
    severity: pipelineSeverity,
    metrics: {
      at_risk_count: context.pipeline_at_risk,
    },
    drill_href: '/crm/ai/insights',
  });

  cards.push(
    buildChannelAnomalyCard({
      meta_open_alerts: context.meta_open_alerts,
      zalo_open_alerts: context.zalo_open_alerts,
      cpl_spike_count: context.cpl_spike_count,
      zero_leads_24h_count: context.zero_leads_24h_count,
      roas_low_count: context.roas_low_count,
      spend_spike_count: context.spend_spike_count,
      top_anomaly_message: context.top_anomaly_message,
      top_anomaly_channel: context.top_anomaly_channel,
      top_anomaly_campaign_id: context.top_anomaly_campaign_id,
    }),
  );

  const debriefCount = context.sci_debrief_count ?? 0;
  const sciSeverity: CoachDigestSeverity =
    debriefCount === 0 ? 'warning' : (context.sci_helpful_rate_pct ?? 100) < 50 ? 'warning' : 'info';
  cards.push({
    key: 'sci_win_loop',
    title: 'SCI win loop (7 ngày)',
    summary:
      debriefCount > 0
        ? `${debriefCount} debrief · prep ready ${context.sci_prep_ready ?? 0}${
            context.sci_top_tier ? ` · tier phổ biến ${context.sci_top_tier}` : ''
          }`
        : 'Chưa có debrief SCI sau chốt/lost',
    severity: sciSeverity,
    metrics: {
      prep_ready: context.sci_prep_ready ?? 0,
      debrief_count: debriefCount,
      helpful_rate_pct: context.sci_helpful_rate_pct ?? null,
      top_tier: context.sci_top_tier ?? null,
    },
    drill_href: '/crm/ai/insights?tab=sci',
  });

  const narrativeParts = [
    `Tuần ${context.week_label} — tóm tắt coach cho team.`,
    context.sla_breach > 0
      ? `Ưu tiên: xử lý ${context.sla_breach} lead SLA breach trên CSKH board.`
      : 'SLA lead ổn định.',
    (tierBreach.first_call_15m ?? 0) > 0
      ? `${tierBreach.first_call_15m} breach 15p (chưa gọi: ${context.root_cause_no_call ?? 0}).`
      : '',
    (tierBreach.b2_complete_4h ?? 0) > 0
      ? `${tierBreach.b2_complete_4h} breach 4h B2.`
      : '',
    (tierBreach.close_24h ?? 0) > 0 ? `${tierBreach.close_24h} breach 24h chốt/lost.` : '',
    rate != null ? `AI acceptance ${rate}% (${context.accepted} chấp nhận, ${context.dismissed} bỏ).` : '',
    context.pipeline_at_risk > 0
      ? `${context.pipeline_at_risk} deal cần manager review trên pipeline risk.`
      : 'Pipeline không có deal stalled nghiêm trọng.',
    channelAnomalyNarrativeLine({
      meta_open_alerts: context.meta_open_alerts,
      zalo_open_alerts: context.zalo_open_alerts,
      cpl_spike_count: context.cpl_spike_count,
      zero_leads_24h_count: context.zero_leads_24h_count,
      roas_low_count: context.roas_low_count,
      spend_spike_count: context.spend_spike_count,
      top_anomaly_message: context.top_anomaly_message,
      top_anomaly_channel: context.top_anomaly_channel,
      top_anomaly_campaign_id: context.top_anomaly_campaign_id,
    }),
    debriefCount > 0
      ? `SCI: ${debriefCount} debrief, helpful ${context.sci_helpful_rate_pct ?? '—'}%.`
      : 'SCI: chưa có debrief win loop.',
  ].filter(Boolean);

  const narrative = narrativeParts.join(' ');
  const severity = worstSeverity(cards);

  const emailPreview = [
    `Coach digest — ${context.week_label}`,
    '',
    ...cards.map((card) => `- ${card.title}: ${card.summary}`),
    '',
    'Xem chi tiết: /crm/ai/coach',
    'Read-only — không có hành động HR tự động.',
  ].join('\n');

  return {
    week_key: context.week_key,
    week_label: context.week_label,
    week_start: context.week_start,
    week_end: context.week_end,
    team_id: context.team_id,
    narrative,
    severity,
    cards,
    email_preview: emailPreview,
  };
}
