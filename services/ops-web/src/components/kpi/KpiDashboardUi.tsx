'use client';

import Link from 'next/link';
import { formatNumber, formatOwnerMetric, formatPct, formatVnd, ownerMetricTargetLabel } from '@/lib/kpi/format';

export interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'critical';
  href?: string;
}

export function KpiTileGrid({ tiles }: { tiles: KpiTileProps[] }) {
  return (
    <div className="kpi-tile-grid" role="list">
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}

export function KpiTile({ label, value, hint, tone = 'default', href }: KpiTileProps) {
  const body = (
    <div className={`kpi-tile kpi-tile--${tone}`} role="listitem">
      <p className="kpi-tile__label">{label}</p>
      <p className="kpi-tile__value">{value}</p>
      {hint ? <p className="kpi-tile__hint muted">{hint}</p> : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="kpi-tile-link">
        {body}
      </Link>
    );
  }
  return body;
}

export function KpiSparkline({
  data,
  width = 220,
  height = 52,
  label,
  className = 'kpi-sparkline',
}: {
  data: number[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
}) {
  if (!data.length) {
    return <span className="muted">—</span>;
  }
  const pad = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function KpiBarChart({
  title,
  items,
  unit = '%',
  maxValue,
}: {
  title: string;
  items: Array<{ label: string; value: number | null; href?: string }>;
  unit?: string;
  maxValue?: number;
}) {
  const numeric = items.map((i) => (i.value == null || !Number.isFinite(i.value) ? 0 : i.value));
  const max = maxValue ?? Math.max(...numeric, 1);

  return (
    <section className="kpi-bar-chart" aria-label={title}>
      <h3 className="kpi-section-title">{title}</h3>
      {items.length === 0 ? <p className="muted">Chưa có dữ liệu.</p> : null}
      <div className="kpi-bar-chart__rows">
        {items.map((item) => {
          const val = item.value == null || !Number.isFinite(item.value) ? 0 : item.value;
          const widthPct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
          const labelNode = item.href ? (
            <Link href={item.href} className="kpi-bar-chart__label nav-link">
              {item.label}
            </Link>
          ) : (
            <span className="kpi-bar-chart__label">{item.label}</span>
          );
          return (
            <div key={item.label} className="kpi-bar-chart__row">
              {labelNode}
              <div className="kpi-bar-chart__track" aria-hidden="true">
                <div className="kpi-bar-chart__fill" style={{ width: `${widthPct}%` }} />
              </div>
              <span className="kpi-bar-chart__value">
                {item.value == null ? '—' : unit === '₫' ? formatVnd(item.value) : `${formatNumber(item.value)}${unit}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function KpiProgressList({
  items,
  staffHref,
}: {
  items: Array<{ key: string; label: string; value: number; target?: number | null }>;
  staffHref?: string;
}) {
  if (items.length === 0) {
    return <p className="muted">Chưa có số liệu.</p>;
  }

  return (
    <ul className="kpi-progress-list">
      {items.map((item) => {
        const target = item.target != null && item.target > 0 ? item.target : null;
        const pct = target ? Math.min(100, Math.round((item.value / target) * 100)) : null;
        return (
          <li key={item.key} className="kpi-progress-item">
            <div className="kpi-progress-item__head">
              <span>{item.label}</span>
              <span className="muted">
                {formatNumber(item.value)}
                {target != null ? ` / ${formatNumber(target)}` : ''}
                {pct != null ? ` (${pct}%)` : ''}
              </span>
            </div>
            {pct != null ? (
              <div className="kpi-progress-item__track" aria-hidden="true">
                <div
                  className={`kpi-progress-item__fill${pct >= 100 ? ' kpi-progress-item__fill--ok' : pct < 70 ? ' kpi-progress-item__fill--low' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
      {staffHref ? (
        <li className="kpi-progress-item kpi-progress-item--link">
          <Link href={staffHref} className="nav-link">
            Xem hồ sơ nhân viên →
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

function alertTone(level: unknown): 'critical' | 'warning' | 'default' {
  const raw = String(level ?? '').toLowerCase();
  if (raw === 'critical' || raw === 'crit') return 'critical';
  if (raw === 'warn' || raw === 'warning') return 'warning';
  return 'default';
}

export function KpiAlertList({
  alerts,
  emptyLabel = 'Không có cảnh báo.',
}: {
  alerts: Array<Record<string, unknown>>;
  emptyLabel?: string;
}) {
  if (alerts.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <ul className="kpi-alert-list">
      {alerts.map((alert, index) => {
        const tone = alertTone(alert.level ?? alert.severity);
        const title = String(alert.title ?? alert.message ?? alert.metric_name ?? 'Cảnh báo');
        const detail = String(alert.message ?? alert.reason ?? '');
        const staff = alert.staff_name ? String(alert.staff_name) : '';
        const staffIdRaw = alert.staff_id;
        const staffId =
          staffIdRaw != null && staffIdRaw !== '' && Number.isFinite(Number(staffIdRaw))
            ? Number(staffIdRaw)
            : null;
        const metricName = alert.metric_name ? String(alert.metric_name) : '';
        return (
          <li key={String(alert.alert_id ?? alert.kpi_id ?? alert.id ?? index)} className={`kpi-alert kpi-alert--${tone}`}>
            <span className={`kpi-alert__badge kpi-alert__badge--${tone}`}>
              {tone === 'critical' ? 'Nghiêm trọng' : tone === 'warning' ? 'Cảnh báo' : 'Thông tin'}
            </span>
            <div className="kpi-alert__body">
              <strong>{title}</strong>
              {metricName ? <p className="muted kpi-alert__meta">{metricName}</p> : null}
              {detail && detail !== title ? <p className="muted kpi-alert__detail">{detail}</p> : null}
              {staff ? (
                staffId ? (
                  <p className="kpi-alert__meta">
                    <Link href={`/crm/staff/${staffId}`} className="nav-link">
                      {staff} →
                    </Link>
                  </p>
                ) : (
                  <p className="muted kpi-alert__meta">{staff}</p>
                )
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function KpiTrendPanel({
  title,
  labels,
  series,
  valueFormatter,
}: {
  title: string;
  labels: string[];
  series: number[];
  valueFormatter?: (value: number) => string;
}) {
  const latest = series.length ? series[series.length - 1] : null;
  const fmt = valueFormatter ?? formatNumber;
  return (
    <div className="kpi-trend-panel">
      <p className="kpi-tile__label">{title}</p>
      <p className="kpi-tile__value">{latest == null ? '—' : fmt(latest)}</p>
      <KpiSparkline data={series} label={title} />
      {labels.length ? (
        <p className="muted kpi-trend-panel__range">
          {labels[0]} → {labels[labels.length - 1]}
        </p>
      ) : null}
    </div>
  );
}

export function extractTrendSeries(trends: Record<string, unknown> | null | undefined): {
  labels: string[];
  mrr: number[];
  concentration: number[];
  cac: number[];
} {
  const root = trends ?? {};
  const nested = (root.trends as Record<string, unknown> | undefined) ?? root;
  return {
    labels: (nested.labels as string[] | undefined) ?? [],
    mrr: (nested.mrr_bookings_vnd as number[] | undefined) ?? [],
    concentration: (nested.top2_concentration_pct as number[] | undefined) ?? [],
    cac: (nested.cac_vnd as number[] | undefined) ?? [],
  };
}

export function businessDashboardTiles(dashboard: Record<string, unknown> | null, alertCount: number): KpiTileProps[] {
  const exec = (dashboard?.exec_metrics ?? {}) as Record<string, unknown>;
  const mrr = (exec.mrr_arr ?? {}) as Record<string, unknown>;
  const ar = (dashboard?.ar_aging ?? {}) as Record<string, unknown>;
  const retention = (dashboard?.retention_metrics ?? {}) as Record<string, unknown>;

  return [
    {
      label: 'MRR bookings',
      value: formatVnd(mrr.mrr_bookings_vnd),
      hint: 'Doanh thu recurring tháng',
      tone: 'default',
      href: '/crm/financials',
    },
    {
      label: 'AR quá hạn',
      value: formatVnd(ar.total_overdue_vnd),
      hint: `Chờ thu: ${formatVnd(ar.total_pending_vnd)}`,
      tone: Number(ar.total_overdue_vnd ?? 0) > 0 ? 'warning' : 'success',
      href: '/crm/financials',
    },
    {
      label: 'Retention MoM',
      value: formatPct(retention.customer_retention_pct),
      hint: `Active KH: ${formatNumber(retention.active_customers)}`,
      tone: Number(retention.customer_retention_pct ?? 100) >= 90 ? 'success' : 'warning',
      href: '/crm/hub',
    },
    {
      label: 'Cảnh báo KPI',
      value: formatNumber(alertCount),
      hint: 'Finance + delivery + portfolio',
      tone: alertCount > 0 ? 'critical' : 'success',
      href: '/crm/kpi',
    },
  ];
}

const OWNER_WEEKLY_BLOCK_KEYS = ['cash', 'sales', 'efficiency', 'risk'] as const;

function ownerRagClass(status: unknown): string {
  const raw = String(status ?? '').toLowerCase();
  if (raw === 'green') return 'kpi-rag--green';
  if (raw === 'yellow') return 'kpi-rag--yellow';
  if (raw === 'red') return 'kpi-rag--red';
  return 'kpi-rag--neutral';
}

export function ownerWeeklySummaryTiles(dashboard: Record<string, unknown> | null): KpiTileProps[] {
  const week = (dashboard?.week ?? {}) as Record<string, unknown>;
  const rag = (dashboard?.rag_counts ?? {}) as Record<string, number>;
  const brief = (dashboard?.pre_execution ?? {}) as Record<string, unknown>;
  return [
    {
      label: 'Tuần báo cáo',
      value: String(week.iso_week ?? '—'),
      hint: String(week.label ?? ''),
    },
    {
      label: 'Chỉ số xanh',
      value: formatNumber(rag.green ?? 0),
      tone: 'success',
    },
    {
      label: 'Chỉ số vàng / đỏ',
      value: `${formatNumber(rag.yellow ?? 0)} / ${formatNumber(rag.red ?? 0)}`,
      tone: Number(rag.red ?? 0) > 0 ? 'critical' : Number(rag.yellow ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      label: 'Hành động cần xử lý',
      value: formatNumber(brief.action_count ?? 0),
      tone: Number(brief.action_count ?? 0) > 0 ? 'warning' : 'success',
    },
  ];
}

export function OwnerWeeklyBlockGrid({ dashboard }: { dashboard: Record<string, unknown> | null }) {
  const blocks = (dashboard?.blocks ?? {}) as Record<string, Record<string, unknown>>;
  return (
    <div className="owner-weekly-grid">
      {OWNER_WEEKLY_BLOCK_KEYS.map((key) => {
        const block = blocks[key] ?? { key, label: key, metrics: [] };
        const metrics = (block.metrics as Record<string, unknown>[]) ?? [];
        return (
          <section key={key} className="owner-weekly-block card" style={{ padding: '0.85rem' }}>
            <h3 className="kpi-section-title">{String(block.label ?? key)}</h3>
            {metrics.length === 0 ? <p className="muted">Chưa có số liệu.</p> : null}
            <ul className="owner-weekly-metrics">
              {metrics.map((metric) => {
                const metricKey = String(metric.key ?? metric.label ?? 'metric');
                return (
                  <li key={metricKey} className={`owner-weekly-metric ${ownerRagClass(metric.status)}`}>
                    <div className="owner-weekly-metric__head">
                      <span>{String(metric.label ?? metricKey)}</span>
                      <span className={`kpi-rag-badge ${ownerRagClass(metric.status)}`}>
                        {String(metric.status_label ?? metric.status ?? '—')}
                      </span>
                    </div>
                    <div className="owner-weekly-metric__values">
                      <strong>{formatOwnerMetric(metric.value, metric.format ?? metric.fmt)}</strong>
                      <span className="muted">
                        Target: {ownerMetricTargetLabel(metric.target, metric.format ?? metric.fmt)}
                      </span>
                    </div>
                    {metric.note ? <p className="muted owner-weekly-metric__note">{String(metric.note)}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function OwnerWeeklyActionList({ dashboard }: { dashboard: Record<string, unknown> | null }) {
  const brief = (dashboard?.pre_execution ?? {}) as Record<string, unknown>;
  const actions = (brief.actions as Record<string, unknown>[]) ?? [];
  if (!actions.length) {
    return <p className="muted">Không có hành động ưu tiên tuần này.</p>;
  }
  return (
    <ul className="kpi-alert-list">
      {actions.map((action, index) => {
        const tone = String(action.status) === 'red' ? 'critical' : 'warning';
        return (
          <li key={String(action.metric_key ?? index)} className={`kpi-alert kpi-alert--${tone}`}>
            <span className={`kpi-alert__badge kpi-alert__badge--${tone}`}>
              {String(action.status_label ?? action.status ?? 'Theo dõi')}
            </span>
            <div className="kpi-alert__body">
              <strong>
                {String(action.block_label ?? action.block)} — {String(action.metric_label ?? action.metric_key)}
              </strong>
              {action.hint ? <p className="muted kpi-alert__detail">{String(action.hint)}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OwnerWeeklyConfigForm({
  targets,
  onChange,
}: {
  targets: Record<string, number>;
  onChange: (key: string, value: number) => void;
}) {
  const entries = Object.entries(targets).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    return <p className="muted">Chưa có target cấu hình.</p>;
  }
  return (
    <div className="owner-weekly-config">
      {entries.map(([key, value]) => (
        <label key={key} className="owner-weekly-config__row">
          <span className="owner-weekly-config__label">{key.replace(/_/g, ' ')}</span>
          <input
            type="number"
            className="kpi-input"
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(key, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  );
}

const AR_BUCKET_ORDER = ['not_due', '1_30', '31_60', '61_90', 'over_90'] as const;

export function ArAgingPanel({ arAging }: { arAging: Record<string, unknown> | null }) {
  if (!arAging) {
    return <p className="muted">Chưa có dữ liệu AR aging.</p>;
  }
  const buckets = (arAging.buckets ?? {}) as Record<string, number>;
  const labels = (arAging.bucket_labels ?? {}) as Record<string, string>;
  const items = AR_BUCKET_ORDER.map((key) => ({
    label: labels[key] ?? key.replace(/_/g, ' '),
    value: buckets[key] ?? 0,
  }));
  const tiles: KpiTileProps[] = [
    {
      label: 'Tổng chờ thu',
      value: formatVnd(arAging.total_pending_vnd),
      tone: 'default',
    },
    {
      label: 'Quá hạn',
      value: formatVnd(arAging.total_overdue_vnd),
      tone: Number(arAging.total_overdue_vnd ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      label: 'As of',
      value: String(arAging.as_of ?? '—'),
      hint: `${formatNumber((arAging.items as unknown[] | undefined)?.length ?? 0)} khoản`,
    },
  ];
  return (
    <>
      <KpiTileGrid tiles={tiles} />
      <KpiBarChart title="Phân bổ AR aging (VNĐ)" items={items} unit="₫" />
    </>
  );
}

export function financialSummaryTiles(
  financials: Record<string, unknown> | null,
  arAging?: Record<string, unknown> | null,
): KpiTileProps[] {
  const rows = (financials?.rows ?? []) as Array<Record<string, unknown>>;
  const totalReceived = rows.reduce((sum, row) => sum + Number(row.received_revenue ?? 0), 0);
  const totalExpenses = rows.reduce((sum, row) => sum + Number(row.total_expenses ?? 0), 0);
  const margins = rows
    .map((row) => Number(row.margin_pct))
    .filter((value) => Number.isFinite(value));
  const avgMargin =
    margins.length > 0 ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
  const ar = (arAging ?? (financials?.ar_aging as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  const overdue = Number(ar.total_overdue_vnd ?? 0);
  return [
    {
      label: 'Lifecycle active',
      value: formatNumber(rows.length),
      hint: 'Dịch vụ đang chạy',
    },
    {
      label: 'Doanh thu thu',
      value: formatVnd(totalReceived),
      hint: 'Tổng received lifecycle',
    },
    {
      label: 'Chi phí',
      value: formatVnd(totalExpenses),
      hint: 'Delivery + presales',
      tone: totalExpenses > totalReceived ? 'warning' : 'default',
    },
    {
      label: 'Margin TB',
      value: avgMargin == null ? '—' : formatPct(avgMargin),
      tone: avgMargin != null && avgMargin >= 30 ? 'success' : 'warning',
    },
    {
      label: 'AR quá hạn',
      value: formatVnd(overdue),
      hint: `Chờ thu: ${formatVnd(ar.total_pending_vnd)}`,
      tone: overdue > 0 ? 'critical' : 'success',
      href: '/crm/hub',
    },
  ];
}
