'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchReviewQueueMetrics, type ReviewQueueMetrics } from '@/lib/api';

interface Props {
  token: string;
}

export function ReviewQueueMetricsBanner({ token }: Props) {
  const [metrics, setMetrics] = useState<ReviewQueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchReviewQueueMetrics(token);
      setMetrics(out);
    } catch (err) {
      setMetrics(null);
      setError(err instanceof Error ? err.message : 'Không tải review queue metrics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <p className="muted">Đang tải aggregate review queue…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!metrics) return null;

  const tone = metrics.age_gate_pass ? 'banner-success' : 'banner-warning';

  return (
    <section
      className={`review-queue-metrics banner ${tone}`}
      aria-label="Review queue age aggregate"
      data-testid="review-queue-metrics-banner"
    >
      <div className="review-queue-metrics__head">
        <div>
          <strong>Review queue age (aggregate)</strong>
          <p className="muted review-queue-metrics__sub">
            {metrics.queue_count} lead · target max &lt;{metrics.target_hours}h
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
          Làm mới
        </button>
      </div>
      <div className="review-queue-metrics__grid">
        <span>
          Max <strong>{metrics.max_hours != null ? `${metrics.max_hours}h` : '—'}</strong>
        </span>
        <span>
          Avg <strong>{metrics.avg_hours != null ? `${metrics.avg_hours}h` : '—'}</strong>
        </span>
        <span>
          ≥24h <strong>{metrics.over_24h_count}</strong>
          {metrics.over_24h_pct != null ? ` (${metrics.over_24h_pct}%)` : ''}
        </span>
        <span className={metrics.age_gate_pass ? 'success' : 'warning'}>
          {metrics.age_gate_pass ? 'Đạt gate age' : 'Chưa đạt gate age'}
        </span>
      </div>
      {!metrics.age_gate_pass ? (
        <Link href="/crm/gdkd-enterprise" className="nav-link">
          Xem KPI GDKD →
        </Link>
      ) : null}
    </section>
  );
}
