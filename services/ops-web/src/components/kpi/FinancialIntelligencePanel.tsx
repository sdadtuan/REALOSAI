'use client';

import Link from 'next/link';
import {
  KpiSparkline,
  KpiTileGrid,
  type KpiTileProps,
} from '@/components/kpi/KpiDashboardUi';
import { formatNumber, formatPct, formatVnd } from '@/lib/kpi/format';

export interface FinanceIntelligenceData {
  burn_rate?: {
    monthly_burn_vnd?: number;
    monthly_revenue_vnd?: number;
    runway_months?: number | null;
    active_lifecycle_count?: number;
  };
  margin_at_risk?: {
    threshold_pct?: number;
    count?: number;
    revenue_vnd?: number;
    profit_vnd?: number;
  };
  trends?: {
    labels?: string[];
    revenue_vnd?: number[];
    cost_vnd?: number[];
  };
  actions?: Array<Record<string, unknown>>;
  action_count?: number;
}

export function financialIntelligenceTiles(data: FinanceIntelligenceData | null): KpiTileProps[] {
  const burn = data?.burn_rate ?? {};
  const risk = data?.margin_at_risk ?? {};
  const runway = burn.runway_months;
  return [
    {
      label: 'Burn rate tháng',
      value: formatVnd(burn.monthly_burn_vnd),
      hint:
        runway != null
          ? `Runway ~${formatNumber(runway)} tháng · ${formatNumber(burn.active_lifecycle_count)} lifecycle`
          : `Chi phí delivery tháng · ${formatNumber(burn.active_lifecycle_count)} lifecycle`,
      tone: Number(burn.monthly_burn_vnd ?? 0) > Number(burn.monthly_revenue_vnd ?? 0) ? 'warning' : 'default',
    },
    {
      label: 'Margin at risk',
      value: formatNumber(risk.count ?? 0),
      hint: `< ${formatPct(risk.threshold_pct ?? 20, 0)} · ${formatVnd(risk.revenue_vnd)} doanh thu`,
      tone: Number(risk.count ?? 0) > 0 ? 'critical' : 'success',
    },
  ];
}

function actionTone(level: unknown): 'critical' | 'warning' | 'default' {
  const raw = String(level ?? '').toLowerCase();
  if (raw === 'critical') return 'critical';
  if (raw === 'warning' || raw === 'warn') return 'warning';
  return 'default';
}

export function FinancialIntelligencePanel({ data }: { data: FinanceIntelligenceData | null }) {
  if (!data) {
    return <p className="muted">Chưa có dữ liệu financial intelligence.</p>;
  }

  const trends = data.trends ?? {};
  const labels = trends.labels ?? [];
  const revenue = trends.revenue_vnd ?? [];
  const cost = trends.cost_vnd ?? [];
  const actions = data.actions ?? [];

  return (
    <section className="financial-intelligence-panel">
      <div className="financial-intelligence-panel__head">
        <h3 className="kpi-section-title">Financial intelligence</h3>
        <p className="muted">Burn rate · margin at risk · xu hướng 6 tháng</p>
      </div>

      <KpiTileGrid tiles={financialIntelligenceTiles(data)} />

      <div className="financial-intelligence-panel__trends">
        <div className="financial-intelligence-trend">
          <p className="kpi-tile__label">Doanh thu thu (6T)</p>
          <p className="kpi-tile__value">{revenue.length ? formatVnd(revenue[revenue.length - 1]) : '—'}</p>
          <KpiSparkline data={revenue} label="Doanh thu 6 tháng" />
        </div>
        <div className="financial-intelligence-trend">
          <p className="kpi-tile__label">Chi phí delivery (6T)</p>
          <p className="kpi-tile__value">{cost.length ? formatVnd(cost[cost.length - 1]) : '—'}</p>
          <KpiSparkline data={cost} label="Chi phí 6 tháng" className="kpi-sparkline kpi-sparkline--cost" />
        </div>
        {labels.length ? (
          <p className="muted financial-intelligence-panel__range">
            {labels[0]} → {labels[labels.length - 1]}
          </p>
        ) : null}
      </div>

      <div className="financial-intelligence-panel__actions">
        <h4 className="kpi-section-title">Cần xử lý</h4>
        {actions.length === 0 ? (
          <p className="muted">Không có lifecycle margin đỏ hoặc AR &gt;30 ngày.</p>
        ) : (
          <ul className="kpi-alert-list">
            {actions.map((action, index) => {
              const tone = actionTone(action.level);
              const href = action.href ? String(action.href) : undefined;
              return (
                <li key={String(action.id ?? index)} className={`kpi-alert kpi-alert--${tone}`}>
                  <span className={`kpi-alert__badge kpi-alert__badge--${tone}`}>
                    {String(action.kind) === 'ar' ? 'AR' : 'Margin'}
                  </span>
                  <div className="kpi-alert__body">
                    <strong>{String(action.title ?? 'Cần xử lý')}</strong>
                    {action.message ? <p className="muted kpi-alert__detail">{String(action.message)}</p> : null}
                    {href ? (
                      <p className="kpi-alert__meta">
                        <Link href={href} className="nav-link">
                          Mở chi tiết →
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
