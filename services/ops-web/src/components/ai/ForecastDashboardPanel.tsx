'use client';

import Link from 'next/link';
import type { AiScoreFactor, ForecastStageBucket } from '@/lib/ai-api';
import { formatVnd } from '@/lib/kpi/format';

export function ForecastStageChart({ buckets }: { buckets: ForecastStageBucket[] }) {
  if (!buckets.length) {
    return <p className="muted">Chưa có dữ liệu stage — chạy snapshot RNOS-17.</p>;
  }

  const max = Math.max(...buckets.map((b) => b.weighted_vnd), 1);

  return (
    <div className="forecast-stage-chart" data-testid="forecast-stage-chart">
      {buckets.map((bucket) => (
        <div key={bucket.stage} className="forecast-stage-chart__row">
          <span className="forecast-stage-chart__label">{bucket.label}</span>
          <div className="forecast-stage-chart__bar-wrap">
            <div
              className="forecast-stage-chart__bar forecast-stage-chart__bar--weighted"
              style={{ width: `${Math.round((100 * bucket.weighted_vnd) / max)}%` }}
              title={`Weighted: ${formatVnd(bucket.weighted_vnd)}`}
            />
            <div
              className="forecast-stage-chart__bar forecast-stage-chart__bar--raw"
              style={{ width: `${Math.round((100 * bucket.raw_vnd) / max)}%` }}
              title={`Raw: ${formatVnd(bucket.raw_vnd)}`}
            />
          </div>
          <span className="forecast-stage-chart__value muted">{formatVnd(bucket.weighted_vnd)}</span>
        </div>
      ))}
      <p className="muted forecast-stage-chart__legend">Thanh đậm: weighted · Thanh nhạt: pipeline raw</p>
    </div>
  );
}

export function ForecastExplainPanel({
  factors,
  summaryNote,
  stalledDealCount,
}: {
  factors: AiScoreFactor[];
  summaryNote: string;
  stalledDealCount: number;
}) {
  return (
    <section className="forecast-explain-panel" data-testid="forecast-explain-panel">
      <h3 className="kpi-section-title">Giải thích AI</h3>
      <p className="forecast-explain-panel__summary">{summaryNote}</p>
      {stalledDealCount > 0 ? (
        <p className="forecast-explain-panel__nba">
          AI: {stalledDealCount} deal &gt;7 ngày stalled —{' '}
          <Link href="/crm/sales">xem NBA →</Link>
        </p>
      ) : null}
      {factors.length ? (
        <ul className="ai-explain-chips">
          {factors.map((factor) => (
            <li key={factor.key}>
              {factor.label} ({factor.sign}
              {formatVnd(factor.delta)})
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Chưa có factor — cần snapshot pipeline.</p>
      )}
    </section>
  );
}
