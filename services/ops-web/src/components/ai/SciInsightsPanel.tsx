'use client';

import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import { formatPct } from '@/lib/kpi/format';
import type { LmpSciAnalyticsMetrics } from '@/lib/ai-api';

type Props = {
  metrics: LmpSciAnalyticsMetrics | null;
  days: number;
  loading?: boolean;
};

export function SciInsightsPanel({ metrics, days, loading }: Props) {
  if (loading && !metrics) {
    return <p className="muted">Đang tải KPI SCI…</p>;
  }

  const m = metrics;
  const tierTotal =
    (m?.tier_mix.CB ?? 0) + (m?.tier_mix.TC ?? 0) + (m?.tier_mix.CS ?? 0) || 0;

  const tiles: KpiTileProps[] = [
    {
      label: 'Prep ready',
      value: String(m?.prep_ready_count ?? 0),
      hint: `${m?.prep_running_count ?? 0} đang chạy · ${days} ngày`,
      tone: (m?.prep_ready_count ?? 0) > 0 ? 'success' : 'default',
    },
    {
      label: 'Debrief đã gửi',
      value: String(m?.debrief_submitted_count ?? 0),
      hint: `EC-LMP-19 · ${m?.chot_with_sci_count ?? 0} won`,
      tone: (m?.debrief_submitted_count ?? 0) > 0 ? 'success' : 'warning',
    },
    {
      label: 'SCI helpful',
      value: m?.helpful_rate_pct == null ? '—' : formatPct(m.helpful_rate_pct),
      hint: 'Từ debrief AM',
      tone:
        m?.helpful_rate_pct == null
          ? 'default'
          : m.helpful_rate_pct >= 60
            ? 'success'
            : 'warning',
    },
    {
      label: 'Avg readiness',
      value: m?.avg_close_readiness != null ? `${m.avg_close_readiness}/100` : '—',
      hint: 'Close readiness score',
    },
    {
      label: 'Tier CB',
      value: tierTotal ? formatPct(((m?.tier_mix.CB ?? 0) / tierTotal) * 100) : '—',
      hint: `${m?.tier_mix.CB ?? 0} deal`,
    },
    {
      label: 'Tier TC',
      value: tierTotal ? formatPct(((m?.tier_mix.TC ?? 0) / tierTotal) * 100) : '—',
      hint: `${m?.tier_mix.TC ?? 0} deal`,
      tone: 'success',
    },
    {
      label: 'Tier CS',
      value: tierTotal ? formatPct(((m?.tier_mix.CS ?? 0) / tierTotal) * 100) : '—',
      hint: `${m?.tier_mix.CS ?? 0} deal`,
    },
  ];

  return (
    <section className="ai-insights-page__section">
      <h3 className="kpi-section-title">SCI Win Loop · KPI</h3>
      <KpiTileGrid tiles={tiles} />
      {(m?.top_objections?.length ?? 0) > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <h4 className="kpi-section-title" style={{ fontSize: '0.95rem' }}>
            Top objection (anonymized)
          </h4>
          <ul>
            {m!.top_objections.map((row) => (
              <li key={row.objection}>
                {row.objection} <span className="muted">({row.count})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Chưa có objection từ debrief trong {days} ngày.
        </p>
      )}
    </section>
  );
}
