import {
  deltaPct,
  enrichThemeQuarterRows,
} from './theme-quarter-delta.util';
import type { ThemeQuarterCountRow } from './market-research.types';

describe('theme-quarter-delta.util', () => {
  it('deltaPct returns null when prev is 0', () => {
    expect(deltaPct(5, 0)).toBeNull();
  });

  it('deltaPct rounds percent change', () => {
    expect(deltaPct(6, 4)).toBe(50);
    expect(deltaPct(3, 4)).toBe(-25);
  });

  it('enrichThemeQuarterRows adds QoQ for Q2+ and YoY when prior year exists', () => {
    const current: ThemeQuarterCountRow[] = [
      { quarter: 1, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
      { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 4 },
    ];
    const priorYear: ThemeQuarterCountRow[] = [
      { quarter: 2, theme_code: 'PRICE', label_vi: 'Giá', insight_count: 2 },
    ];

    const out = enrichThemeQuarterRows(current, priorYear);

    expect(out[0]).toMatchObject({
      quarter: 1,
      prev_qoq_count: null,
      delta_qoq_pct: null,
      prev_yoy_count: null,
      delta_yoy_pct: null,
    });
    expect(out[1]).toMatchObject({
      quarter: 2,
      prev_qoq_count: 2,
      delta_qoq_pct: 100,
      prev_yoy_count: 2,
      delta_yoy_pct: 100,
    });
  });
});
