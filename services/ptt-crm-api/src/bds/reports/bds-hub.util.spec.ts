import { clampInbox, sellThroughPct } from './bds-hub.util';

describe('bds-hub.util', () => {
  it('sellThroughPct 2/8 → 25', () => {
    expect(sellThroughPct(2, 8)).toBe(25);
  });

  it('clampInbox max 8', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      kind: 'hold_f1_pending' as const,
      id: String(i),
      label: 'x',
      href: '/crm/bds/holds',
    }));
    expect(clampInbox(rows)).toHaveLength(8);
  });
});
