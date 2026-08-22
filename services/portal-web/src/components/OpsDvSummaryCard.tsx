'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchPortalOpsLinkedLifecycle,
  fetchPortalOpsLifecycleSummary,
  type OpsPortalSummary,
} from '@/lib/api';
import { isOpsPortalSummaryFeEnabled } from '@/lib/ops-portal-flags';

export interface OpsDvSummaryCardProps {
  token: string;
}

function kpiLabelVi(label: OpsPortalSummary['kpi']['overall_label']): string {
  if (label === 'Dat') return 'Đạt';
  if (label === 'CanChuY') return 'Cần chú ý';
  if (label === 'KhongDat') return 'Không đạt';
  return 'Đang cập nhật';
}

export function OpsDvSummaryCard({ token }: OpsDvSummaryCardProps) {
  const [summary, setSummary] = useState<OpsPortalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpsPortalSummaryFeEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const linked = await fetchPortalOpsLinkedLifecycle(token);
        if (!linked.enabled || linked.lifecycle_id == null) {
          setSummary(null);
          return;
        }
        const out = await fetchPortalOpsLifecycleSummary(token, linked.lifecycle_id);
        setSummary(out.enabled ? out : null);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (!isOpsPortalSummaryFeEnabled()) return null;

  if (loading) {
    return (
      <section className="card portal-mkt-ai-summary" aria-busy="true" data-testid="portal-ops-summary">
        <h2 className="portal-mkt-ai-summary__title">Vận hành dịch vụ</h2>
        <p className="muted">Đang tải tóm tắt…</p>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section className="card portal-mkt-ai-summary" data-testid="portal-ops-summary">
      <div className="portal-mkt-ai-summary__head">
        <div>
          <h2 className="portal-mkt-ai-summary__title">Vận hành dịch vụ</h2>
          <p className="muted portal-mkt-ai-summary__subtitle">
            {summary.dv_code} · {summary.dv_name} · {summary.stage}
          </p>
        </div>
        <span className="portal-mkt-ai-summary__score">{kpiLabelVi(summary.kpi.overall_label)}</span>
      </div>

      <p className="portal-mkt-ai-summary__excerpt">{summary.status_message_vi}</p>

      <div className="portal-mkt-ai-summary__meta">
        <span>Tuần {summary.iso_week}: {summary.weekly.progress_pct}% hoàn thành</span>
        <span>KPI {summary.kpi.period_key}</span>
      </div>

      {summary.kpi.metrics.length > 0 ? (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
          {summary.kpi.metrics.slice(0, 4).map((m) => (
            <li key={m.key}>
              {m.label}: {kpiLabelVi(m.status_label)}
              {m.progress_pct != null ? ` (${m.progress_pct}%)` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="muted portal-mkt-ai-summary__footer">
        <Link href="/service-delivery" className="nav-link">
          Xem chi tiết triển khai
        </Link>
        {' · '}
        Tóm tắt read-only — liên hệ AM/SP để trao đổi chi tiết.
      </p>
    </section>
  );
}
