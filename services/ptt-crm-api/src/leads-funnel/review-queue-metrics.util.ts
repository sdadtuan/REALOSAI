export const REVIEW_QUEUE_AGE_TARGET_HOURS = 24;

export interface ReviewQueueMetrics {
  ok: true;
  generated_at: string;
  queue_count: number;
  max_hours: number | null;
  avg_hours: number | null;
  over_24h_count: number;
  over_24h_pct: number | null;
  target_hours: number;
  age_gate_pass: boolean;
}

export function buildReviewQueueMetrics(
  leads: Array<{ hours_waiting?: number | null }>,
  now = new Date(),
): ReviewQueueMetrics {
  const hours = leads
    .map((row) => row.hours_waiting)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const queue_count = leads.length;
  const max_hours = hours.length ? Math.max(...hours) : null;
  const avg_hours = hours.length
    ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10
    : null;
  const over_24h_count = hours.filter((value) => value >= REVIEW_QUEUE_AGE_TARGET_HOURS).length;
  const over_24h_pct =
    queue_count > 0 ? Math.round((over_24h_count / queue_count) * 1000) / 10 : null;

  const age_gate_pass =
    queue_count === 0 || (max_hours != null && max_hours < REVIEW_QUEUE_AGE_TARGET_HOURS);

  return {
    ok: true,
    generated_at: now.toISOString(),
    queue_count,
    max_hours,
    avg_hours,
    over_24h_count,
    over_24h_pct,
    target_hours: REVIEW_QUEUE_AGE_TARGET_HOURS,
    age_gate_pass,
  };
}
