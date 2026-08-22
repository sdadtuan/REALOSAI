import { aggregateSpeedMetrics, percentile } from './b2b-speed.util';

describe('b2b-speed.util', () => {
  it('computes p95 from sorted durations', () => {
    expect(percentile([10, 20, 30, 40, 100], 95)).toBe(100);
  });

  it('aggregates p50/p95', () => {
    const out = aggregateSpeedMetrics({
      durationsSec: [10, 20, 30, 40, 100],
      hotDurationsSec: [15, 25],
    });
    expect(out.n).toBe(5);
    expect(out.p95_seconds).toBe(100);
    expect(out.hot_p95_seconds).toBe(25);
  });
});
