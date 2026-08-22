'use client';

import type { ReactNode } from 'react';
import { PageToolbar } from './PageToolbar';

type ChannelHubLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  banner?: ReactNode;
  filters?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

export function ChannelHubLayout({
  title,
  subtitle,
  actions,
  banner,
  filters,
  summary,
  children,
}: ChannelHubLayoutProps) {
  return (
    <>
      {banner}
      <PageToolbar title={title} subtitle={subtitle} actions={actions} />
      <div className="page-card stack-gap">
        {filters}
        {summary ? <div className="channel-hub-summary">{summary}</div> : null}
        {children}
      </div>
    </>
  );
}
