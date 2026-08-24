'use client';

import type { ReactNode } from 'react';

function fmtVnd(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function fmtText(value: unknown, fallback = '—'): string {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 34%) 1fr',
        gap: '0.5rem 1rem',
        padding: '0.45rem 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="agency-stat-card">
      <span className="muted" style={{ fontSize: '0.8rem' }}>
        {label}
      </span>
      <strong style={{ fontSize: '1.15rem' }}>{value}</strong>
      {hint ? (
        <span className="muted" style={{ fontSize: '0.75rem' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  summary: Record<string, unknown>;
};

export function ReProjectSummaryPanel({ summary }: Props) {
  const project = (summary.project ?? {}) as Record<string, unknown>;
  const inventory = (summary.inventory ?? {}) as Record<string, unknown>;
  const byZone = (inventory.by_zone ?? []) as Array<Record<string, unknown>>;

  const location = [project.district, project.city].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '1rem 1.1rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Thông tin dự án</h3>
        <DetailRow label="Mã dự án" value={fmtText(project.code)} />
        <DetailRow label="Loại hình" value={fmtText(project.project_type_label ?? project.project_type)} />
        <DetailRow
          label="Trạng thái"
          value={
            <span className="agency-status-badge badge-onboarding">
              {fmtText(project.status_label ?? project.status)}
            </span>
          }
        />
        <DetailRow label="Chủ đầu tư" value={fmtText(project.developer_name)} />
        <DetailRow label="Nhà đầu tư" value={fmtText(project.investor_name)} />
        <DetailRow label="Địa chỉ" value={fmtText(project.location_address)} />
        <DetailRow label="Khu vực" value={location || '—'} />
        <DetailRow
          label="Quy mô"
          value={`${fmtText(project.total_units, '0')} căn · đã bán ${fmtText(project.sold_units, '0')}`}
        />
        <DetailRow label="Mục tiêu doanh thu" value={fmtVnd(project.revenue_target_vnd)} />
      </section>

      <section>
        <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem' }}>Chỉ số nhanh</h3>
        <div className="agency-stat-grid">
          <StatCard
            label="Sản phẩm"
            value={String(summary.product_count ?? 0)}
            hint={`${String(summary.products_available ?? 0)} còn · ${String(summary.products_sold ?? 0)} đã bán`}
          />
          <StatCard label="KPI" value={String(summary.kpi_count ?? 0)} hint={`TB đạt ${String(summary.kpi_avg_achievement_pct ?? 0)}%`} />
          <StatCard
            label="Rủi ro"
            value={String(summary.risk_count ?? 0)}
            hint={`${String(summary.high_risk_count ?? 0)} mức cao`}
          />
          <StatCard label="Khu / dòng SP" value={`${String(summary.product_zones_count ?? 0)} / ${String(summary.product_lines_count ?? 0)}`} />
        </div>
      </section>

      <section
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '1rem 1.1rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Ngân sách & P&amp;L</h3>
        <div className="agency-stat-grid" style={{ marginBottom: '0.75rem' }}>
          <StatCard label="DT kế hoạch" value={fmtVnd(summary.budget_revenue_planned_vnd)} />
          <StatCard label="DT thực tế" value={fmtVnd(summary.budget_revenue_actual_vnd)} />
          <StatCard label="Chi phí KH" value={fmtVnd(summary.budget_cost_planned_vnd)} />
          <StatCard label="Chi phí TT" value={fmtVnd(summary.budget_cost_actual_vnd)} />
          <StatCard label="LN kế hoạch" value={fmtVnd(summary.profit_planned_vnd)} />
          <StatCard label="LN thực tế" value={fmtVnd(summary.profit_actual_vnd)} />
        </div>
      </section>

      {byZone.length > 0 ? (
        <section>
          <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem' }}>Tồn kho theo khu</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {byZone.map((z, i) => (
              <li key={String(z.zone ?? i)}>
                {fmtText(z.zone)}: {String(z.available ?? 0)} còn / {String(z.total ?? 0)} tổng
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
