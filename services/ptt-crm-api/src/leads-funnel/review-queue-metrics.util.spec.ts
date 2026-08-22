import { buildReviewQueueMetrics } from './review-queue-metrics.util';

describe('review-queue-metrics.util', () => {
  it('aggregates queue age metrics', () => {
    const out = buildReviewQueueMetrics([
      { hours_waiting: 10 },
      { hours_waiting: 26 },
      { hours_waiting: 18 },
    ]);
    expect(out.queue_count).toBe(3);
    expect(out.max_hours).toBe(26);
    expect(out.avg_hours).toBe(18);
    expect(out.over_24h_count).toBe(1);
    expect(out.age_gate_pass).toBe(false);
  });

  it('passes when queue is empty', () => {
    const out = buildReviewQueueMetrics([]);
    expect(out.age_gate_pass).toBe(true);
    expect(out.max_hours).toBeNull();
  });
});
