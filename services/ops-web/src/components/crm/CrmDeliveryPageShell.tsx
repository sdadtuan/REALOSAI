'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildCrmDeliveryModuleLinks } from '@/lib/crm/delivery-module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type CrmDeliveryPageShellProps = {
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

export function CrmDeliveryPageShell({
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
}: CrmDeliveryPageShellProps) {
  const moduleLinks = buildCrmDeliveryModuleLinks(user);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={
        breadcrumb ?? [
          { label: 'CRM', href: '/crm/leads' },
          { label: 'Triển khai DV', href: '/crm/service-delivery' },
          { label: title },
        ]
      }
      width={width}
      loading={loading}
    >
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? (
        <ModuleSubNav links={moduleLinks} ariaLabel="CRM delivery module" />
      ) : null}
      {children}
    </StaffPageShell>
  );
}
