'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildCrmHrModuleLinks } from '@/lib/crm/hr-module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type CrmHrPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  showModuleNav?: boolean;
  hideToolbar?: boolean;
  width?: 'default' | 'wide' | 'narrow';
  loading?: boolean;
  children: ReactNode;
};

export function CrmHrPageShell({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  breadcrumb,
  showModuleNav = true,
  hideToolbar = false,
  width = 'wide',
  loading,
  children,
}: CrmHrPageShellProps) {
  const moduleLinks = buildCrmHrModuleLinks(user);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={
        breadcrumb ?? [
          { label: 'CRM', href: '/crm' },
          { label: 'Nhân sự', href: '/crm/hr' },
          { label: title },
        ]
      }
      width={width}
      loading={loading}
    >
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? <ModuleSubNav links={moduleLinks} ariaLabel="CRM HR module" /> : null}
      {children}
    </StaffPageShell>
  );
}
