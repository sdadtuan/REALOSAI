import { buildCoachDigest } from './coach-digest.engine';

describe('coach-digest.engine', () => {
  it('builds digest cards with drill-down hrefs', () => {
    const digest = buildCoachDigest({
      team_id: 'org',
      week_key: '2026-W30',
      week_label: '2026-07-21 → 2026-07-27',
      week_start: '2026-07-21',
      week_end: '2026-07-27',
      sla_breach: 4,
      sla_warning: 2,
      sla_ok: 20,
      sla_tier_breach: { first_call_15m: 3, b2_complete_4h: 1, close_24h: 0 },
      sla_tier_warning: { first_call_15m: 1, b2_complete_4h: 1, close_24h: 0 },
      top_breach_lines: ['#1 Chưa gọi lần đầu (Gọi lần đầu 15p)'],
      root_cause_no_call: 3,
      root_cause_no_b2: 1,
      root_cause_no_close: 0,
      acceptance_rate_pct: 18,
      accepted: 9,
      dismissed: 41,
      pending: 3,
      top_dismiss_reasons: [{ reason: 'wrong_tone', count: 12 }],
      pipeline_at_risk: 5,
      meta_open_alerts: 2,
      zalo_open_alerts: 1,
      cpl_spike_count: 2,
      zero_leads_24h_count: 1,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: 'CPL spike',
      top_anomaly_channel: 'meta',
      top_anomaly_campaign_id: 'camp_1',
      sci_debrief_count: 3,
      sci_prep_ready: 8,
      sci_helpful_rate_pct: 72,
      sci_top_tier: 'TC',
    });

    expect(digest.cards).toHaveLength(6);
    expect(digest.cards[0].drill_href).toBe('/crm/cskh-board?sla_filter=breach');
    expect(digest.cards[1].key).toBe('sla_meta_24h');
    expect(digest.cards[2].drill_href).toBe('/crm/ai/insights?status=dismissed');
    expect(digest.cards.find((c) => c.key === 'sci_win_loop')?.drill_href).toBe(
      '/crm/ai/insights?tab=sci',
    );
    expect(digest.severity).toBe('critical');
    expect(digest.email_preview).toContain('Coach digest');
  });

  it('uses info severity when metrics healthy', () => {
    const digest = buildCoachDigest({
      team_id: 'org',
      week_key: '2026-W30',
      week_label: '2026-07-21 → 2026-07-27',
      week_start: '2026-07-21',
      week_end: '2026-07-27',
      sla_breach: 0,
      sla_warning: 0,
      sla_ok: 30,
      acceptance_rate_pct: 45,
      accepted: 20,
      dismissed: 10,
      pending: 1,
      top_dismiss_reasons: [],
      pipeline_at_risk: 0,
      meta_open_alerts: 0,
      zalo_open_alerts: 0,
      cpl_spike_count: 0,
      zero_leads_24h_count: 0,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: null,
      top_anomaly_channel: null,
      top_anomaly_campaign_id: null,
      sci_debrief_count: 2,
      sci_prep_ready: 5,
      sci_helpful_rate_pct: 80,
    });
    expect(digest.severity).toBe('info');
  });
});
