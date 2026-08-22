'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchPortalAiReportSummary, type PortalAiReportSummaryResponse } from '@/lib/api';
import { fmtNumber, fmtPct, fmtVnd } from '@/lib/format';

export interface PortalAiReportSummaryProps {
  token: string;
}

export function PortalAiReportSummary({ token }: PortalAiReportSummaryProps) {
  const [data, setData] = useState<PortalAiReportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchPortalAiReportSummary(token, { days: 7 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <section className="card portal-ai-summary" aria-busy="true" data-testid="portal-ai-summary-block">
        <div className="portal-ai-summary__head">
          <h2 className="portal-ai-summary__title">Tuần này</h2>
        </div>
        <p className="muted">Đang tạo tóm tắt…</p>
      </section>
    );
  }

  if (!data?.enabled) {
    return null;
  }

  return (
    <section className="card portal-ai-summary" aria-live="polite" data-testid="portal-ai-summary-block">
      <div className="portal-ai-summary__head">
        <div>
          <h2 className="portal-ai-summary__title">Tuần này</h2>
          <p className="muted portal-ai-summary__subtitle">{data.period.label}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Mở rộng' : 'Thu gọn'}
        </button>
      </div>

      {!collapsed ? (
        <>
          <p className="portal-ai-summary__narrative">{data.narrative}</p>

          {data.bullets.length > 0 ? (
            <ul className="portal-ai-summary__bullets">
              {data.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}

          <div className="portal-ai-summary__kpis">
            <div className="portal-ai-summary__kpi">
              <span className="muted">Chi phí</span>
              <strong>{fmtVnd(data.kpis.total_spend)}</strong>
            </div>
            <div className="portal-ai-summary__kpi">
              <span className="muted">Lead CRM</span>
              <strong>{fmtNumber(data.kpis.total_leads_crm)}</strong>
            </div>
            <div className="portal-ai-summary__kpi">
              <span className="muted">CPL TB</span>
              <strong>{fmtVnd(data.kpis.avg_cpl)}</strong>
            </div>
            <div className="portal-ai-summary__kpi">
              <span className="muted">ROAS</span>
              <strong>
                {data.kpis.avg_roas != null
                  ? `${data.kpis.avg_roas.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}x`
                  : '—'}
              </strong>
            </div>
            <div className="portal-ai-summary__kpi">
              <span className="muted">Unmapped</span>
              <strong>{fmtPct(data.kpis.unmapped_spend_pct)}</strong>
            </div>
          </div>

          <p className="muted portal-ai-summary__footer">
            Tóm tắt AI client-safe — chỉ số đã gộp, không hiển thị dữ liệu nội bộ.{' '}
            <Link href="/meta">Xem chi tiết Meta</Link>
            {data.data_freshness?.through_date ? ` · Cập nhật ${data.data_freshness.through_date}` : ''}
          </p>
        </>
      ) : null}
    </section>
  );
}
