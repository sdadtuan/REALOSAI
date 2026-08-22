import type { CskhBoardRow } from './cskh-board.types';
import { buildBreachBacklogSnapshot, countUniqueBreachLeads, resolveCskhShift } from './cskh-breach-backlog.util';

describe('cskh-breach-backlog.util', () => {
  it('dedupes breach leads across tiers', () => {
    const rows = [
      {
        id: 1,
        sla_tiers: [
          { tier: 'first_call_15m', sla_state: 'breach' },
          { tier: 'b2_complete_4h', sla_state: 'breach' },
        ],
      },
      {
        id: 2,
        sla_tiers: [{ tier: 'close_24h', sla_state: 'breach' }],
      },
    ] as unknown as CskhBoardRow[];

    const counts = countUniqueBreachLeads(rows);
    expect(counts.unique_breach_leads).toBe(2);
    expect(counts.tier_breach_counts.first_call_15m).toBe(1);
    expect(counts.tier_breach_counts.close_24h).toBe(1);
  });

  it('passes gate when backlog is zero', () => {
    const snap = buildBreachBacklogSnapshot([] as CskhBoardRow[]);
    expect(snap.backlog_count).toBe(0);
    expect(snap.gate_pass).toBe(true);
  });

  it('resolves ICT shift window', () => {
    const morning = resolveCskhShift(new Date('2026-08-04T03:00:00.000Z')); // 10:00 ICT
    expect(morning.shift_key).toBe('morning');
  });
});
