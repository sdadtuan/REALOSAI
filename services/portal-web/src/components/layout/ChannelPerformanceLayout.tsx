'use client';

import Link from 'next/link';
import type { PerformanceChannel } from '@/lib/api';
import { portalChannelConfig } from '@/lib/portal/channels';
import { PerformancePanel } from '@/components/PerformancePanel';
import { ChannelSwitcher } from './ChannelSwitcher';
import { PageToolbar } from './PageToolbar';

type ChannelPerformanceLayoutProps = {
  channel: PerformanceChannel;
  token: string;
};

export function ChannelPerformanceLayout({ channel, token }: ChannelPerformanceLayoutProps) {
  const config = portalChannelConfig(channel);

  return (
    <div className={`channel-performance channel-performance--${channel}`}>
      <ChannelSwitcher active={channel} />
      <PageToolbar
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <Link href="/dashboard" className="btn btn-secondary btn-sm">
            ← Tổng quan
          </Link>
        }
      />
      <div className="page-card stack-gap">
        <PerformancePanel
          token={token}
          channel={channel}
          title="Bảng hiệu suất"
          subtitle={config.label}
          hideChannelColumn
          embedded
        />
      </div>
    </div>
  );
}
