'use client';

import type { PerformanceChannel } from '@/lib/api';
import { portalChannelConfig } from '@/lib/portal/channels';
import { ChannelPerformanceLayout } from '@/components/layout/ChannelPerformanceLayout';
import { PortalPageShell } from '@/components/PortalPageShell';

type ChannelPerformancePageProps = {
  channel: PerformanceChannel;
};

export function ChannelPerformancePage({ channel }: ChannelPerformancePageProps) {
  const config = portalChannelConfig(channel);

  return (
    <PortalPageShell
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: config.breadcrumb },
      ]}
    >
      {({ token }) => <ChannelPerformanceLayout channel={channel} token={token} />}
    </PortalPageShell>
  );
}
