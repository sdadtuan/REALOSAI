'use client';

import type { ReactNode } from 'react';
import { PageToolbar } from './PageToolbar';
import { SegmentedControl } from './SegmentedControl';

type HubTab<T extends string> = {
  id: T;
  label: string;
  badge?: number | string;
  hidden?: boolean;
};

type HubPageLayoutProps<T extends string> = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  tabs?: HubTab<T>[];
  tab?: T;
  onTabChange?: (tab: T) => void;
  tabLabel?: string;
  children: ReactNode;
};

export function HubPageLayout<T extends string>({
  title,
  subtitle,
  actions,
  headerExtra,
  tabs,
  tab,
  onTabChange,
  tabLabel,
  children,
}: HubPageLayoutProps<T>) {
  const visibleTabs = tabs?.filter((t) => !t.hidden) ?? [];

  return (
    <>
      <PageToolbar title={title} subtitle={subtitle} actions={actions} />
      {headerExtra}
      {visibleTabs.length && tab != null && onTabChange ? (
        <SegmentedControl
          label={tabLabel}
          options={visibleTabs.map(({ id, label, badge }) => ({ id, label, badge }))}
          value={tab}
          onChange={onTabChange}
        />
      ) : null}
      <div className="page-card stack-gap">{children}</div>
    </>
  );
}
