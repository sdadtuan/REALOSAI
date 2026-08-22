'use client';

import Link from 'next/link';
import { KpiSparkline, KpiTrendPanel } from '@/components/kpi/KpiDashboardUi';
import { formatNumber, formatVnd } from '@/lib/kpi/format';

export interface ExecutiveWeeklyTrends {
  weeks?: number;
  anchor?: string;
  labels?: string[];
  revenue_vnd?: number[];
  leads?: number[];
}

export interface AttributionDrillRow {
  campaign_key: string;
  campaign_label: string;
  lead_count: number;
  sample_lead_id: number | null;
  sample_lead_name: string | null;
  hub_href: string;
  lead_href: string | null;
}

export interface BusinessExecutiveData {
  weekly_trends?: ExecutiveWeeklyTrends;
  attribution_drill?: {
    rows?: AttributionDrillRow[];
    count?: number;
  };
}

export function BusinessExecutivePanel({ data }: { data: BusinessExecutiveData | null }) {
  const weekly = data?.weekly_trends ?? {};
  const labels = weekly.labels ?? [];
  const revenue = weekly.revenue_vnd ?? [];
  const leads = weekly.leads ?? [];
  const drillRows = data?.attribution_drill?.rows ?? [];

  return (
    <section className="business-executive-panel">
      <div className="business-executive-panel__head">
        <h3 className="kpi-section-title">Executive trends · 12 tuần</h3>
        <p className="muted">
          Sparkline doanh thu thu & lead mới · anchor {weekly.anchor ?? '—'}
        </p>
      </div>

      <div className="business-executive-panel__trends kpi-trend-grid">
        <KpiTrendPanel
          title="Doanh thu thu (tuần)"
          labels={labels}
          series={revenue}
          valueFormatter={formatVnd}
        />
        <KpiTrendPanel title="Lead mới (tuần)" labels={labels} series={leads} valueFormatter={formatNumber} />
        <div className="kpi-trend-panel">
          <p className="kpi-tile__label">Tổng 12 tuần</p>
          <p className="kpi-tile__value">{formatVnd(revenue.reduce((sum, v) => sum + v, 0))}</p>
          <KpiSparkline data={revenue} label="Doanh thu 12 tuần" />
          <p className="muted kpi-trend-panel__range">
            {formatNumber(leads.reduce((sum, v) => sum + v, 0))} lead · {labels[0] ?? '—'} → {labels[labels.length - 1] ?? '—'}
          </p>
        </div>
      </div>

      <div className="business-executive-panel__drill">
        <h3 className="kpi-section-title">Attribution drill (≤3 click)</h3>
        <p className="muted">Dashboard → Hub campaign → Lead mẫu</p>
        {drillRows.length === 0 ? (
          <p className="muted">Chưa có lead gắn campaign trong kỳ.</p>
        ) : (
          <div className="business-drill-table-wrap">
            <table className="business-drill-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Leads</th>
                  <th>Drill path</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((row) => (
                  <tr key={row.campaign_key}>
                    <td>
                      <strong>{row.campaign_label}</strong>
                    </td>
                    <td>{formatNumber(row.lead_count)}</td>
                    <td className="business-drill-table__path">
                      <Link href={row.hub_href} className="nav-link">
                        Hub →
                      </Link>
                      {row.lead_href ? (
                        <>
                          <span className="muted" aria-hidden="true">
                            {' '}
                            ·{' '}
                          </span>
                          <Link href={row.lead_href} className="nav-link">
                            Lead {row.sample_lead_id}
                            {row.sample_lead_name ? ` · ${row.sample_lead_name}` : ''} →
                          </Link>
                        </>
                      ) : (
                        <span className="muted"> · chưa có lead mẫu</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
