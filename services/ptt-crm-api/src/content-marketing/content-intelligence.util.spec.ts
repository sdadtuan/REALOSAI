import {
  aggregateIntelligence,
  buildTopicSuggestions,
  mergeExternalIntoChannels,
  parseMetricsRange,
  scoreMetricRow,
  summarizeMetrics,
} from './content-intelligence.util';
import type { CmktMetricWithItemRow } from './content-marketing.types';

describe('content-intelligence.util', () => {
  const range = parseMetricsRange('30d');

  it('parses day ranges', () => {
    expect(parseMetricsRange('7d').days).toBe(7);
    expect(parseMetricsRange('').days).toBe(30);
  });

  it('aggregates metrics by channel and ranks top items', () => {
    const rows: CmktMetricWithItemRow[] = [
      {
        id: 1,
        item_id: 10,
        channel: 'facebook',
        metric_date: range.toDate,
        impressions: 1000,
        engagements: 120,
        clicks: 40,
        leads: 2,
        source: 'manual',
        raw_json: {},
        created_at: new Date().toISOString(),
        item_title: 'Hero post',
        item_status: 'published',
      },
      {
        id: 2,
        item_id: 11,
        channel: 'linkedin',
        metric_date: range.toDate,
        impressions: 500,
        engagements: 20,
        clicks: 5,
        leads: 0,
        source: 'manual',
        raw_json: {},
        created_at: new Date().toISOString(),
        item_title: 'LinkedIn post',
        item_status: 'published',
      },
    ];
    const intel = aggregateIntelligence(rows, range, { facebook: 1, linkedin: 1 });
    expect(intel.by_channel.facebook.engagements).toBe(120);
    expect(intel.by_channel.facebook.avg_engagement).toBe(12);
    expect(intel.top_items[0].item_id).toBe(10);
    expect(scoreMetricRow(rows[0])).toBeGreaterThan(scoreMetricRow(rows[1]));
  });

  it('builds topic suggestions from intelligence', () => {
    const intel = aggregateIntelligence([], range, { facebook: 2 });
    const suggestions = buildTopicSuggestions({
      intelligence: intel,
      pillarNames: ['Launch'],
      brandName: 'Acme',
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('Launch') || s.includes('Acme'))).toBe(true);
  });

  it('merges external metrics into channel stats', () => {
    const intel = aggregateIntelligence([], range, { facebook: 1 });
    const merged = mergeExternalIntoChannels(intel.by_channel, {
      enabled: true,
      sources: ['meta'],
      by_channel: {
        facebook: { source: 'meta', linked_items: 2, impressions: 100 },
      },
    });
    expect(merged.facebook.external_source).toBe('meta');
    expect(merged.facebook.external_metrics?.linked_items).toBe(2);
  });

  it('summarizes totals', () => {
    const rows: CmktMetricWithItemRow[] = [
      {
        id: 1,
        item_id: 1,
        channel: 'facebook',
        metric_date: range.toDate,
        impressions: 100,
        engagements: 10,
        clicks: 2,
        leads: 1,
        source: 'manual',
        raw_json: {},
        created_at: new Date().toISOString(),
        item_title: 'A',
        item_status: 'published',
      },
    ];
    const summary = summarizeMetrics(rows, range, { facebook: 1 });
    expect(summary.totals.impressions).toBe(100);
    expect(summary.entries_count).toBe(1);
  });
});
