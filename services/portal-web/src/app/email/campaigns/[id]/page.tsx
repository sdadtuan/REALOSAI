'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EmailPortalShell } from '@/components/email/EmailPortalShell';
import { portalEmailCampaignStats, type PortalEmailCampaignStats } from '@/lib/api';

export default function PortalEmailCampaignStatsPage() {
  const params = useParams();
  const campaignId = String(params.id ?? '');

  return (
    <EmailPortalShell
      title="Campaign performance"
      subtitle={`Campaign #${campaignId}`}
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: 'Email', href: '/email' },
        { label: 'Campaign stats' },
      ]}
      actions={
        <Link href="/email" className="btn btn-secondary btn-sm">
          ← Email dashboard
        </Link>
      }
    >
      {({ token, emailEnabled }) =>
        emailEnabled ? <CampaignStatsContent token={token} campaignId={campaignId} /> : null
      }
    </EmailPortalShell>
  );
}

function CampaignStatsContent({ token, campaignId }: { token: string; campaignId: string }) {
  const [stats, setStats] = useState<PortalEmailCampaignStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setStats(await portalEmailCampaignStats(token, campaignId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải stats thất bại');
    }
  }, [token, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Đang tải…</p>;

  return (
    <article className="portal-campaign-stats">
      <h2 className="portal-campaign-stats__title">{stats.campaign_name}</h2>
      <p className="muted">
        Status: <span className="badge">{stats.status}</span>
      </p>
      <div className="kpi-tile-grid">
        <div className="kpi-tile">
          <p className="kpi-tile__label">Audience</p>
          <p className="kpi-tile__value">{stats.audience_count ?? '—'}</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label">Sent</p>
          <p className="kpi-tile__value">{stats.sent}</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label">Opens</p>
          <p className="kpi-tile__value">{stats.opens}</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label">Clicks</p>
          <p className="kpi-tile__value">{stats.clicks}</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label">Open rate</p>
          <p className="kpi-tile__value">{stats.open_rate_pct}%</p>
        </div>
        <div className="kpi-tile">
          <p className="kpi-tile__label">Click rate</p>
          <p className="kpi-tile__value">{stats.click_rate_pct}%</p>
        </div>
        <div className="kpi-tile kpi-tile--success">
          <p className="kpi-tile__label">Revenue</p>
          <p className="kpi-tile__value">{stats.revenue_attrib}</p>
        </div>
      </div>
    </article>
  );
}
