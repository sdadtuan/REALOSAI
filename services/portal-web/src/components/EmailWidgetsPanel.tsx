'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { portalEmailDashboard, type PortalEmailDashboard } from '@/lib/api';

export interface EmailWidgetsPanelProps {
  token: string;
  showApprovalsLink?: boolean;
}

export function EmailWidgetsPanel({ token, showApprovalsLink = false }: EmailWidgetsPanelProps) {
  const [data, setData] = useState<PortalEmailDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    portalEmailDashboard(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi tải email dashboard'));
  }, [token]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Đang tải email metrics…</p>;

  return (
    <>
      <div className="seo-widgets-grid">
        <div className="seo-widget-card seo-widget-card--warn">
          <p className="seo-widget-label">Pending approval</p>
          <strong className="seo-widget-value">{data.pending_approvals}</strong>
        </div>
        <div className="seo-widget-card">
          <p className="seo-widget-label">Sent (28d)</p>
          <strong className="seo-widget-value">{data.campaigns_sent_28d.toLocaleString()}</strong>
        </div>
        <div className="seo-widget-card seo-widget-card--ok">
          <p className="seo-widget-label">Open rate</p>
          <strong className="seo-widget-value">{data.open_rate_pct}%</strong>
        </div>
        <div className="seo-widget-card seo-widget-card--featured">
          <p className="seo-widget-label">Revenue attrib.</p>
          <strong className="seo-widget-value">{data.revenue_attrib}</strong>
        </div>
      </div>
      <section className="portal-hub-section">
        <h3 className="portal-hub-section__title">Recent campaigns</h3>
        {data.recent_campaigns.length === 0 ? (
          <p className="muted">Chưa có campaign.</p>
        ) : (
          <ul className="portal-content-list">
            {data.recent_campaigns.map((c) => (
              <li key={c.id} className="portal-content-list__item">
                <Link href={`/email/campaigns/${c.id}`} className="portal-content-list__link">
                  {c.name}
                </Link>
                <span className="badge">{c.status}</span>
                {c.audience_count != null ? (
                  <span className="muted portal-content-list__meta">{c.audience_count} contacts</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {showApprovalsLink && data.pending_approvals > 0 ? (
          <p className="portal-module-meta">
            <Link href="/email/approvals">→ {data.pending_approvals} campaign chờ duyệt</Link>
          </p>
        ) : null}
      </section>
    </>
  );
}
