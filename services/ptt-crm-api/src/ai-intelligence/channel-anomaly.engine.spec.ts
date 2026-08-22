import {
  buildAnomalyDigestSnapshot,
  buildChannelAnomalyCard,
  channelAnomalyNarrativeLine,
} from './channel-anomaly.engine';

describe('channel-anomaly.engine', () => {
  const summary = {
    meta_open_alerts: 2,
    zalo_open_alerts: 1,
    cpl_spike_count: 2,
    zero_leads_24h_count: 1,
    roas_low_count: 0,
    spend_spike_count: 1,
    top_anomaly_message: 'CPL spike 45% vs median',
    top_anomaly_channel: 'meta' as const,
    top_anomaly_campaign_id: 'camp_123',
    top_alerts: [
      {
        id: 'a1',
        client_id: 'client-1',
        channel: 'meta',
        external_campaign_id: 'camp_123',
        alert_type: 'cpl_spike',
        severity: 'warning',
        metric_value: 1200000,
        threshold_value: 800000,
        message: 'CPL spike 45% vs median',
        performance_date: '2026-07-27',
        dedupe_key: 'k1',
        acknowledged_at: null,
        created_at: '2026-07-27T01:00:00.000Z',
      },
    ],
  };

  it('builds warning channel anomaly card with drill href', () => {
    const card = buildChannelAnomalyCard(summary);
    expect(card.key).toBe('channel_anomaly');
    expect(card.severity).toBe('warning');
    expect(card.drill_href).toContain('camp_123');
  });

  it('builds hub digest narrative for meta channel', () => {
    const digest = buildAnomalyDigestSnapshot({
      summary,
      channel: 'meta',
      clientId: 'client-1',
    });
    expect(digest.narrative).toMatch(/alert đang mở/i);
    expect(digest.read_only).toBe(true);
    expect(digest.bullets.length).toBeGreaterThan(0);
  });

  it('returns info narrative when no open alerts', () => {
    const empty = {
      meta_open_alerts: 0,
      zalo_open_alerts: 0,
      cpl_spike_count: 0,
      zero_leads_24h_count: 0,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: null,
      top_anomaly_channel: null,
      top_anomaly_campaign_id: null,
    };
    expect(channelAnomalyNarrativeLine(empty)).toMatch(/không có anomaly/i);
  });
});
