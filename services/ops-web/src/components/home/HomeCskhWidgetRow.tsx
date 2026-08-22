'use client';

import Link from 'next/link';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import type { CskhHomeSummary } from '@/lib/api';

function toneClass(count: number, warnAbove = 0): string {
  if (count <= warnAbove) return 'home-cskh-widget--ok';
  return 'home-cskh-widget--alert';
}

export function HomeCskhWidgetRow({
  summary,
  loading,
  error,
}: {
  summary: CskhHomeSummary | null;
  loading: boolean;
  error: string;
}) {
  if (loading && !summary) {
    return <p className="muted">Đang tải tóm tắt CSKH…</p>;
  }
  if (error && !summary) {
    return <p className="error">{error}</p>;
  }
  if (!summary) return null;

  const showAi = aiCopilotEnabled() && summary.ai;

  return (
    <div className="home-cskh-widgets" data-testid="home-cskh-widgets">
      <div className="home-cskh-widgets__grid">
        <Link href="/crm/leads?status=moi" className="home-cskh-widget summary-card">
          <span className="muted">Lead Meta mới hôm nay</span>
          <strong className="home-cskh-widget__value">{summary.leads_new_today}</strong>
          <span className="home-cskh-widget__hint muted">Client active · ICT</span>
        </Link>

        <Link
          href={summary.sla.drill_href}
          className={`home-cskh-widget summary-card ${toneClass(summary.sla.breach_count)}`}
        >
          <span className="muted">SLA breach</span>
          <strong className="home-cskh-widget__value">{summary.sla.breach_count}</strong>
          <span className="home-cskh-widget__hint muted">
            Warning {summary.sla.warning_count}
            {summary.sla.compliance_pct != null ? ` · compliance ${summary.sla.compliance_pct}%` : ''}
          </span>
        </Link>

        <Link
          href={summary.review_queue.drill_href}
          className={`home-cskh-widget summary-card ${toneClass(summary.review_queue.pending_count)}`}
        >
          <span className="muted">Review queue (B2)</span>
          <strong className="home-cskh-widget__value">{summary.review_queue.pending_count}</strong>
          <span className="home-cskh-widget__hint muted">
            {summary.review_queue.max_age_hours != null
              ? `Max chờ ${summary.review_queue.max_age_hours}h`
              : 'Không có lead chờ'}
          </span>
        </Link>

        {showAi && summary.ai ? (
          <Link href={summary.ai.drill_href} className="home-cskh-widget summary-card">
            <span className="muted">Copilot DAU (7 ngày)</span>
            <strong className="home-cskh-widget__value">
              {summary.ai.copilot_dau_pct != null ? `${summary.ai.copilot_dau_pct}%` : '—'}
            </strong>
            <span className="home-cskh-widget__hint muted">
              {summary.ai.copilot_dau_latest}/{summary.ai.pilot_denominator} pilot
            </span>
          </Link>
        ) : null}
      </div>

      <div className="home-cskh-widgets__links">
        <Link href="/crm/leads" className="btn btn-sm btn-ghost">
          Quản lý Lead
        </Link>
        <Link href="/crm/cskh-board" className="btn btn-sm btn-ghost">
          Bảng CSKH SLA
        </Link>
        <Link href="/crm/gdkd-enterprise" className="btn btn-sm btn-ghost">
          KPI GDKD
        </Link>
      </div>
    </div>
  );
}
