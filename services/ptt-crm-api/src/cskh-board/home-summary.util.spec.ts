import type { CskhBoardRow } from './cskh-board.types';
import { buildHomeSummary, countUniqueWarningLeads } from './home-summary.util';
import { CSKH_SLA_COMPLIANCE_TARGETS } from './cskh-board-sla.util';

describe('home-summary.util', () => {
  const tierSummaries = {
    first_call_15m: {
      breach: 1,
      warning: 0,
      ok: 9,
      active: 10,
      evaluated: 10,
      compliance_pct: 90,
      target_pct: CSKH_SLA_COMPLIANCE_TARGETS.first_call_15m,
      compliance_pass: true,
    },
    b2_complete_4h: {
      breach: 0,
      warning: 1,
      ok: 10,
      active: 11,
      evaluated: 10,
      compliance_pct: 100,
      target_pct: CSKH_SLA_COMPLIANCE_TARGETS.b2_complete_4h,
      compliance_pass: true,
    },
    close_24h: {
      breach: 0,
      warning: 0,
      ok: 8,
      active: 8,
      evaluated: 8,
      compliance_pct: 100,
      target_pct: CSKH_SLA_COMPLIANCE_TARGETS.close_24h,
      compliance_pass: true,
    },
  };

  it('counts breach and warning from board rows', () => {
    const out = buildHomeSummary({
      boardRows: [
        {
          id: 1,
          sla_tiers: [
            { tier: 'first_call_15m', sla_state: 'breach' },
            { tier: 'b2_complete_4h', sla_state: 'breach' },
          ],
        },
        {
          id: 2,
          sla_tiers: [{ tier: 'b2_complete_4h', sla_state: 'warning' }],
        },
      ] as unknown as CskhBoardRow[],
      tierSummaries,
      leadsNewToday: 5,
      reviewMetrics: { queue_count: 3, max_hours: 12 },
    });

    expect(out.sla.breach_count).toBe(1);
    expect(out.sla.warning_count).toBe(1);
    expect(out.review_queue.pending_count).toBe(3);
    expect(out.leads_new_today).toBe(5);
    expect(out.sla.compliance_pct).toBe(96.4);
  });

  it('dedupes warning leads across tiers', () => {
    const rows = [
      {
        id: 1,
        sla_tiers: [
          { tier: 'first_call_15m', sla_state: 'warning' },
          { tier: 'b2_complete_4h', sla_state: 'warning' },
        ],
      },
    ] as unknown as CskhBoardRow[];
    expect(countUniqueWarningLeads(rows)).toBe(1);
  });

  it('includes optional ai slice', () => {
    const out = buildHomeSummary({
      boardRows: [],
      tierSummaries,
      leadsNewToday: 0,
      reviewMetrics: { queue_count: 0, max_hours: null },
      ai: {
        copilot_dau_pct: 62,
        pilot_denominator: 5,
        copilot_dau_latest: 3,
        drill_href: '/crm/ai/insights',
      },
    });
    expect(out.ai?.copilot_dau_pct).toBe(62);
  });
});
