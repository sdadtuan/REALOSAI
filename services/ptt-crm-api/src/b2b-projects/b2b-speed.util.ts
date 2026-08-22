import { isWithinBusinessHours } from './b2b-sla.util';

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(idx, sortedAsc.length - 1))];
}

export function speedSecondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export interface SpeedAggregateInput {
  durationsSec: number[];
  hotDurationsSec: number[];
}

export interface SpeedAggregateResult {
  p50_seconds: number;
  p95_seconds: number;
  hot_p95_seconds: number;
  n: number;
}

export function aggregateSpeedMetrics(input: SpeedAggregateInput): SpeedAggregateResult {
  const sorted = [...input.durationsSec].sort((a, b) => a - b);
  const hotSorted = [...input.hotDurationsSec].sort((a, b) => a - b);
  return {
    p50_seconds: percentile(sorted, 50),
    p95_seconds: percentile(sorted, 95),
    hot_p95_seconds: percentile(hotSorted, 95),
    n: sorted.length,
  };
}

export function isSpeedSampleInBusinessHours(
  at: Date,
  hours: { tz: string; days: number[]; start: string; end: string },
): boolean {
  return isWithinBusinessHours(hours, at);
}
