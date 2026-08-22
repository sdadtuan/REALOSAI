import {
  assertSplitsSum100,
  computeLineAmount,
  computeStatementNet,
  pickSchemeTier,
} from './bds-commission.util';

describe('bds-commission.util', () => {
  it('pickSchemeTier takes nearest min_score ≤ agency', () => {
    const rows = [
      { min_score: 0, pct: 1.5 },
      { min_score: 20, pct: 2.0 },
      { min_score: 45, pct: 2.5 },
    ];
    expect(pickSchemeTier(rows, 20)?.pct).toBe(2.0);
    expect(pickSchemeTier(rows, 44)?.pct).toBe(2.0);
    expect(pickSchemeTier(rows, 45)?.pct).toBe(2.5);
  });

  it('BDS-27 net = gross − advance − clawback', () => {
    expect(computeStatementNet({ grossVnd: 1000, advanceVnd: 200, clawbackVnd: 100 })).toBe(700);
  });

  it('split sum not 100 → 400', () => {
    expect(() => assertSplitsSum100([{ pct: 20 }, { pct: 50 }])).toThrow(
      expect.objectContaining({ response: { error: 'split_sum' } }),
    );
  });

  it('computeLineAmount rounds correctly', () => {
    expect(computeLineAmount(1_000_000_000, 2, 80)).toBe(16_000_000);
  });
});
