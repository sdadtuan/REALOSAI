import type { CskhBoardRow } from './cskh-board.types';
import { buildShiftHandoffReport, formatHandoffMarkdown } from './cskh-shift-handoff.util';
import { buildBreachBacklogSnapshot } from './cskh-breach-backlog.util';
import { buildReviewQueueMetrics } from '../leads-funnel/review-queue-metrics.util';

describe('cskh-shift-handoff.util', () => {
  const now = new Date('2026-08-04T07:00:00.000Z'); // 14:00 ICT — ca chiều

  const rows = [
    {
      id: 101,
      full_name: 'Lead A',
      owner_name: 'NV1',
      sla_tiers: [
        { tier: 'first_call_15m', sla_state: 'breach' },
        { tier: 'b2_complete_4h', sla_state: 'warning' },
      ],
    },
    {
      id: 102,
      full_name: 'Lead B',
      owner_name: null,
      sla_tiers: [{ tier: 'close_24h', sla_state: 'breach' }],
    },
  ] as unknown as CskhBoardRow[];

  it('builds handoff report with breach, tiers, and review queue', () => {
    const reviewMetrics = buildReviewQueueMetrics([{ hours_waiting: 26 }, { hours_waiting: 12 }], now);
    const out = buildShiftHandoffReport({ rows, reviewMetrics, now });

    expect(out.ok).toBe(true);
    expect(out.shift.shift_key).toBe('afternoon');
    expect(out.breach_backlog.unique_breach_leads).toBe(2);
    expect(out.open_leads_by_tier.first_call_15m).toBe(1);
    expect(out.review_queue_pending).toBe(2);
    expect(out.review_queue_max_age_hours).toBe(26);
    expect(out.top_breach_leads.length).toBeGreaterThan(0);
    expect(out.top_breach_leads[0].id).toBe(101);
    expect(out.handoff_notes).toContain('CSKH handoff');
    expect(out.handoff_notes).toContain('Breach backlog');
  });

  it('formats markdown with gate status and top breach lines', () => {
    const breach = buildBreachBacklogSnapshot(rows, now);
    const md = formatHandoffMarkdown({
      shift: { shift_key: 'afternoon', shift_label: 'Ca chiều', shift_end_ict: '22:00' },
      generatedAt: now.toISOString(),
      breachBacklog: breach,
      openLeadsByTier: { first_call_15m: 3, b2_complete_4h: 2, close_24h: 1 },
      reviewQueuePending: 4,
      reviewQueueMaxAgeHours: 30,
      topBreachLeads: [{ id: 101, name: 'Lead A', tier: 'first_call_15m', owner_name: 'NV1' }],
    });

    expect(md).toContain('Ca chiều');
    expect(md).toContain('FAIL');
    expect(md).toContain('#101 Lead A');
    expect(md).toContain('BR-AI-01');
  });
});
