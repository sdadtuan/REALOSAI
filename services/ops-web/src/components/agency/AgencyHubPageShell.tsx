'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildAgencyModuleLinks } from '@/lib/agency/module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type AgencyHubPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  agencyUnread?: number;
  showModuleNav?: boolean;
  hideToolbar?: boolean;
  width?: 'default' | 'wide' | 'narrow';
  loading?: boolean;
  children: ReactNode;
};

export function AgencyHubPageShell({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  breadcrumb,
  agencyUnread,
  showModuleNav = true,
  hideToolbar = false,
  width = 'wide',
  loading,
  children,
}: AgencyHubPageShellProps) {
  const moduleLinks = buildAgencyModuleLinks(user, agencyUnread);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={breadcrumb ?? [{ label: 'Agency', href: '/agency' }, { label: title }]}
      width={width}
      agencyUnread={agencyUnread}
      loading={loading}
    >
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? <ModuleSubNav links={moduleLinks} ariaLabel="Agency module" /> : null}
      {children}
    </StaffPageShell>
  );
}
