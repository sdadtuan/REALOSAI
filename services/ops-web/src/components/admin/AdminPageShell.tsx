'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminControlPlaneLayout } from '@/components/admin/AdminLeftRail';
import { PageToolbar, StaffPageShell, type BreadcrumbItem } from '@/components/layout';
import type { StoredStaffUser } from '@/lib/auth';

type AdminSection = 'ai-automation' | 'crm-config';

type AdminPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  section: AdminSection;
  showModuleNav?: boolean;
  hideToolbar?: boolean;
  width?: 'default' | 'wide' | 'narrow';
  loading?: boolean;
  children: ReactNode;
};

function defaultBreadcrumb(title: string): BreadcrumbItem[] {
  return [{ label: 'Quản trị hệ thống', href: '/admin' }, { label: title }];
}

export function AdminPageShell({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  breadcrumb,
  section: _section,
  showModuleNav: _showModuleNav = false,
  hideToolbar = false,
  width = 'wide',
  loading,
  children,
}: AdminPageShellProps) {
  const pathname = usePathname() ?? '';
  const showRail = pathname.startsWith('/admin') && pathname !== '/admin';

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={breadcrumb ?? defaultBreadcrumb(title)}
      width={width}
      loading={loading}
    >
      {showRail ? (
        <AdminControlPlaneLayout user={user}>
          {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
          {children}
        </AdminControlPlaneLayout>
      ) : (
        <>
          {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
          {children}
        </>
      )}
    </StaffPageShell>
  );
}
