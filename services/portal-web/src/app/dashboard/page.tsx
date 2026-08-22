'use client';

import { useEffect, useState } from 'react';
import { ChannelQuickLinks } from '@/components/dashboard/ChannelQuickLinks';
import { DashboardKpiStrip } from '@/components/dashboard/DashboardKpiStrip';
import { PendingApprovalsWidget } from '@/components/PendingApprovalsWidget';
import { PortalAiReportSummary } from '@/components/PortalAiReportSummary';
import { MktAiPlanSummaryCard } from '@/components/MktAiPlanSummaryCard';
import { OpsDvSummaryCard } from '@/components/OpsDvSummaryCard';
import { ContentMarketingSummaryCard } from '@/components/ContentMarketingSummaryCard';
import { PerformancePanel } from '@/components/PerformancePanel';
import { HubPageLayout } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalNotificationSummary,
  portalSeoStatus,
  type PortalNotificationSummaryResponse,
} from '@/lib/api';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';

export default function DashboardPage() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/dashboard' }, { label: 'Tổng quan' }]}>
      {({ token }) => <DashboardContent token={token} />}
    </PortalPageShell>
  );
}

function DashboardContent({ token }: { token: string }) {
  const seoEnabled = usePortalSeoNav(token);
  const { pendingEmail } = usePortalEmailNav(token);
  const [summary, setSummary] = useState<PortalNotificationSummaryResponse | null>(null);
  const [seoPending, setSeoPending] = useState(0);

  useEffect(() => {
    void fetchPortalNotificationSummary(token)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [token]);

  useEffect(() => {
    if (!seoEnabled) {
      setSeoPending(0);
      return;
    }
    void portalSeoStatus(token)
      .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
      .catch(() => setSeoPending(0));
  }, [token, seoEnabled]);

  return (
    <HubPageLayout
      title="Tổng quan hiệu suất"
      subtitle="Meta · Google · Zalo — CPL, chi tiêu và mục cần duyệt"
      headerExtra={
        <>
          <DashboardKpiStrip token={token} />
          <ChannelQuickLinks />
        </>
      }
    >
      <section className="portal-hub-section">
        <PendingApprovalsWidget summary={summary} seoPending={seoPending} emailPending={pendingEmail} />
      </section>

      <section className="portal-hub-section">
        <PortalAiReportSummary token={token} />
      </section>

      <section className="portal-hub-section">
        <MktAiPlanSummaryCard token={token} />
      </section>

      <section className="portal-hub-section">
        <ContentMarketingSummaryCard token={token} />
      </section>

      <section className="portal-hub-section">
        <OpsDvSummaryCard token={token} />
      </section>

      <section className="portal-hub-section portal-hub-section--flush">
        <PerformancePanel token={token} title="Chi tiết theo ngày / chiến dịch" subtitle="Tất cả kênh" embedded />
      </section>
    </HubPageLayout>
  );
}
