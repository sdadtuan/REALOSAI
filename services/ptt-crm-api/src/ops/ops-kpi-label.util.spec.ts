import {
  computeMetricLabels,
  kpiStatusLabel,
  resolveKpiTarget,
} from './ops-kpi-label.util';

describe('ops-kpi-label.util', () => {
  it('kpiStatusLabel BR-OPS-KPI-01 thresholds', () => {
    expect(kpiStatusLabel(100, 100)).toBe('Dat');
    expect(kpiStatusLabel(99, 100)).toBe('CanChuY');
    expect(kpiStatusLabel(70, 100)).toBe('CanChuY');
    expect(kpiStatusLabel(69, 100)).toBe('KhongDat');
    expect(kpiStatusLabel(0, 0)).toBe('Dat');
  });

  it('resolveKpiTarget prefers tier map', () => {
    expect(
      resolveKpiTarget(
        { key: 'posts', label: 'Bài', target_by_tier: { basic: 2, standard: 4, premium: 6 } },
        'premium',
      ),
    ).toBe(6);
  });

  it('computeMetricLabels merges definitions and stored metrics', () => {
    const out = computeMetricLabels(
      { posts: { actual: 3 } },
      [{ key: 'posts', label: 'Bài đăng', target_by_tier: { standard: 4 } }],
      'standard',
    );
    expect(out[0]).toMatchObject({
      key: 'posts',
      actual: 3,
      target: 4,
      status_label: 'CanChuY',
    });
  });
});
