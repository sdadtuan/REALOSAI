'use client';

import Link from 'next/link';
import { aiCopilotEnabled } from '@/lib/ai-flags';
import type { RenewalPortfolioSummary } from '@/lib/ai-api';
import type { CskhHomeSummary } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

function toneClass(count: number, warnAbove = 0): string {
  if (count <= warnAbove) return 'home-cskh-widget--ok';
  return 'home-cskh-widget--alert';
}

export function WinHomeDashboard({
  user,
  summary,
  renewal,
  loading,
  error,
}: {
  user: StoredStaffUser;
  summary: CskhHomeSummary | null;
  renewal?: RenewalPortfolioSummary | null;
  loading: boolean;
  error: string;
}) {
  const canLeads = hasCap(user, 'crm_leads', 'view');
  const canHub = hasCap(user, 'crm_agency', 'view') || hasCap(user, 'crm_board', 'view');
  const showAi = aiCopilotEnabled() && summary?.ai;

  if (loading && !summary) {
    return <p className="muted">Đang tải bảng điều khiển…</p>;
  }
  if (error && !summary) {
    return <p className="error">{error}</p>;
  }
  if (!summary || !canLeads) {
    return (
      <div className="page-card">
        <p className="muted">Không có widget CSKH — cần quyền xem leads.</p>
      </div>
    );
  }

  return (
    <div className="page-card win-home-dashboard" data-testid="win-home-dashboard">
      <h2 className="win-home-dashboard__title">Bảng điều khiển</h2>
      <div className="win-home-dashboard__grid">
        <Link href="/crm/leads?status=moi" className="home-cskh-widget summary-card">
          <span className="muted">Lead mới hôm nay</span>
          <strong className="home-cskh-widget__value">{summary.leads_new_today}</strong>
          <span className="home-cskh-widget__hint muted">Meta client active · ICT</span>
        </Link>

        <Link
          href={summary.sla.drill_href}
          className={`home-cskh-widget summary-card ${toneClass(summary.sla.breach_count)}`}
        >
          <span className="muted">SLA breach</span>
          <strong className="home-cskh-widget__value">{summary.sla.breach_count}</strong>
          <span className="home-cskh-widget__hint muted">
            Warning {summary.sla.warning_count}
            {summary.sla.compliance_pct != null ? ` · ${summary.sla.compliance_pct}%` : ''}
          </span>
        </Link>

        <Link
          href={summary.review_queue.drill_href}
          className={`home-cskh-widget summary-card ${toneClass(summary.review_queue.pending_count)}`}
        >
          <span className="muted">Review queue</span>
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
        ) : (
          <div className="home-cskh-widget summary-card" style={{ opacity: 0.72 }}>
            <span className="muted">Copilot DAU</span>
            <strong className="home-cskh-widget__value">—</strong>
            <span className="home-cskh-widget__hint muted">Chưa bật pilot AI</span>
          </div>
        )}

        {renewal && renewal.t90_count + renewal.t60_count + renewal.t30_count > 0 ? (
          <Link
            href={renewal.drill_href}
            className="home-cskh-widget summary-card home-cskh-widget--alert"
            data-testid="renewal-t90-strip"
          >
            <span className="muted">Renewal T-90</span>
            <strong className="home-cskh-widget__value">{renewal.t90_count}</strong>
            <span className="home-cskh-widget__hint muted">
              T-60 {renewal.t60_count} · T-30 {renewal.t30_count}
            </span>
          </Link>
        ) : null}
      </div>

      <div className="win-home-dashboard__links">
        <Link href="/crm/leads" className="btn btn-sm btn-ghost">
          Leads
        </Link>
        <Link href="/crm/cskh-board" className="btn btn-sm btn-ghost">
          CSKH
        </Link>
        {canHub ? (
          <Link href="/crm/hub" className="btn btn-sm btn-ghost">
            Hub
          </Link>
        ) : null}
        {hasCap(user, 'crm_kpi_records', 'view') ? (
          <Link href="/crm/kpi" className="btn btn-sm btn-ghost">
            KPI
          </Link>
        ) : null}
      </div>
    </div>
  );
}
