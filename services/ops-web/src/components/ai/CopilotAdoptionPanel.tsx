'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPct } from '@/lib/kpi/format';
import { fetchAiAdoptionMetrics, type AiAdoptionMetrics } from '@/lib/ai-api';
import { KpiTrendPanel } from '@/components/kpi/KpiDashboardUi';

export function CopilotAdoptionPanel({ token, days = 14 }: { token: string; days?: number }) {
  const [metrics, setMetrics] = useState<AiAdoptionMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    void fetchAiAdoptionMetrics(token, { days })
      .then((out) => setMetrics(out.data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Tải adoption thất bại');
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  }, [token, days]);

  const trend = useMemo(() => {
    const labels = metrics?.daily_dau.map((row) => row.day.slice(5)) ?? [];
    const series = metrics?.daily_dau.map((row) => row.dau) ?? [];
    return { labels, series };
  }, [metrics]);

  if (loading) return <p className="muted">Đang tải adoption…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!metrics) return null;

  return (
    <section className="copilot-adoption-panel" data-testid="copilot-adoption-panel">
      <h3 className="kpi-section-title">Adoption dashboard · §0.6 DoD v1</h3>
      <div className="copilot-adoption-panel__grid">
        <div className="copilot-adoption-panel__metric">
          <span className="muted">Copilot DAU (pilot)</span>
          <strong data-testid="adoption-dau-rate">
            {metrics.copilot_dau_latest}/{metrics.pilot_denominator} ({formatPct(metrics.copilot_dau_rate_pct)})
          </strong>
          <span className={metrics.copilot_dau_gate_pass ? 'success' : 'warning'}>
            Target ≥{formatPct(metrics.copilot_dau_target_pct)} (G2)
          </span>
        </div>
        <div className="copilot-adoption-panel__metric">
          <span className="muted">AI acceptance</span>
          <strong data-testid="adoption-acceptance-rate">
            {metrics.acceptance_rate_pct != null ? formatPct(metrics.acceptance_rate_pct) : '—'}
          </strong>
          <span className={metrics.acceptance_gate_pass ? 'success' : 'warning'}>
            Target ≥{formatPct(metrics.acceptance_target_pct)} (§0.6)
          </span>
        </div>
        <div className="copilot-adoption-panel__metric">
          <span className="muted">Resolved</span>
          <strong>
            {metrics.accepted} chấp nhận / {metrics.total_resolved} quyết định
          </strong>
        </div>
      </div>
      {trend.labels.length ? (
        <KpiTrendPanel title="Copilot DAU (distinct actor)" labels={trend.labels} series={trend.series} />
      ) : (
        <p className="muted">Chưa có copilot runs trong khoảng thời gian.</p>
      )}
    </section>
  );
}
