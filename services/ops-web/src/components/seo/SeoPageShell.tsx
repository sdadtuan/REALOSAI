'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildSeoModuleLinks } from '@/lib/seo/module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type SeoPageShellProps = {
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

export function SeoPageShell({
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
}: SeoPageShellProps) {
  const moduleLinks = buildSeoModuleLinks(user);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={breadcrumb ?? [{ label: 'SEO / AEO', href: '/seo/hub' }, { label: title }]}
      width={width}
      loading={loading}
    >
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? <ModuleSubNav links={moduleLinks} ariaLabel="SEO module" /> : null}
      {children}
    </StaffPageShell>
  );
}
