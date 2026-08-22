'use client';

import Link from 'next/link';
import { formatPct, formatVnd } from '@/lib/kpi/format';
import type { ForecastVarianceData } from '@/lib/ai-api';

export function ForecastVariancePanel({ data }: { data: ForecastVarianceData | null }) {
  if (!data) {
    return (
      <section className="kpi-page__section forecast-variance-panel" data-testid="forecast-variance-panel">
        <h3 className="kpi-section-title">Forecast variance (T-1)</h3>
        <p className="muted">Chưa có dữ liệu cam kết / thực thu — cần snapshot RNOS-17 và cam kết GDKD.</p>
      </section>
    );
  }

  const tone = data.warn ? 'critical' : 'default';
  const varianceLabel =
    data.variance_vnd === 0
      ? 'Khớp'
      : data.variance_vnd > 0
        ? `+${formatVnd(data.variance_vnd)}`
        : formatVnd(data.variance_vnd);

  return (
    <section
      className={`kpi-page__section forecast-variance-panel forecast-variance-panel--${tone}`}
      data-testid="forecast-variance-panel"
    >
      <div className="forecast-variance-panel__head">
        <h3 className="kpi-section-title">Forecast variance · {data.period_label}</h3>
        <Link href="/crm/forecast" className="btn btn-link">
          Chi tiết forecast →
        </Link>
      </div>
      <div className="forecast-variance-panel__grid">
        <div className="forecast-variance-panel__metric">
          <span className="muted">Cam kết</span>
          <strong data-testid="forecast-variance-committed">{formatVnd(data.committed_vnd)}</strong>
        </div>
        <div className="forecast-variance-panel__metric">
          <span className="muted">Thực thu</span>
          <strong data-testid="forecast-variance-actual">{formatVnd(data.actual_vnd)}</strong>
        </div>
        <div className="forecast-variance-panel__metric">
          <span className="muted">Chênh lệch</span>
          <strong data-testid="forecast-variance-delta">{varianceLabel}</strong>
          {data.variance_pct != null ? (
            <span className="muted"> ({formatPct(data.variance_pct)})</span>
          ) : null}
        </div>
        <div className="forecast-variance-panel__metric">
          <span className="muted">MAPE</span>
          <strong data-testid="forecast-variance-mape">
            {data.mape_pct != null ? formatPct(data.mape_pct) : '—'}
          </strong>
          {data.warn ? <span className="forecast-variance-panel__warn"> &gt;20%</span> : null}
        </div>
      </div>
    </section>
  );
}
