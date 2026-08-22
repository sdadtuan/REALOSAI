import { buildContentWeeklyMemo } from './content-weekly-memo.util';
import { parseSuggestionToIdea } from './content-suggestion-apply.util';
import { parseMetricsRange } from './content-intelligence.util';

describe('content-weekly-memo.util', () => {
  it('builds memo sections from intelligence snapshot', () => {
    const range = parseMetricsRange('7d');
    const memo = buildContentWeeklyMemo({
      brandName: 'Acme',
      weekLabel: '2026-08-03 → 2026-08-09',
      range,
      intelligence: {
        range: range.range,
        from_date: range.fromDate,
        to_date: range.toDate,
        by_channel: { facebook: { published: 2, engagements: 40 } },
        top_items: [{ item_id: 1, title: 'Hero', channel: 'facebook', score: 99 }],
        suggestions: ['Double-down pillar "Launch"'],
        metrics_count: 3,
      },
      counts: {
        ideas: 5,
        items_by_status: {},
        draft: 2,
        in_review: 1,
        published_mtd: 4,
        scheduled_this_week: 2,
        in_review_sla_breach: 0,
      },
      reviewSummary: {
        total: 1,
        sla_breach: 0,
        by_channel: { facebook: 1 },
        sla_target_hours: 48,
        max_hours_in_review: 12,
        avg_hours_in_review: 12,
      },
      suggestions: ['Double-down pillar "Launch"'],
      pillars: ['Launch'],
    });
    expect(memo.title).toContain('Acme');
    expect(memo.body_vi).toContain('## Publish & metrics');
    expect(memo.auto_apply).toBe(false);
  });
});

describe('content-suggestion-apply.util', () => {
  it('parses pillar and channels from suggestion text', () => {
    const parsed = parseSuggestionToIdea({
      suggestion: 'Double-down pillar "Launch" với format carousel trên facebook.',
      pillarNames: ['Launch', 'Brand'],
    });
    expect(parsed.pillar_name).toBe('Launch');
    expect(parsed.channel_hints).toContain('facebook');
    expect(parsed.title.length).toBeGreaterThan(0);
  });
});
