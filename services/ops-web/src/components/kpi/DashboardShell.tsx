'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildFinanceDashboardLinks } from '@/lib/admin/module-nav';
import type { StoredStaffUser } from '@/lib/auth';

interface DashboardShellProps {
  user: StoredStaffUser;
  onLogout: () => void;
  title: string;
  periodHint?: string;
  breadcrumb?: BreadcrumbItem[];
  filters?: ReactNode;
  loading?: boolean;
  error?: string;
  showModuleNav?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
}

export function DashboardShell({
  user,
  onLogout,
  title,
  periodHint,
  breadcrumb,
  filters,
  loading,
  error,
  showModuleNav = true,
  children,
  footer,
  width = 'default',
}: DashboardShellProps) {
  const moduleLinks = buildFinanceDashboardLinks(user);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={
        breadcrumb ?? [
          { label: 'Quản trị', href: '/crm/business-dashboard' },
          { label: title },
        ]
      }
      width={width}
    >
      <PageToolbar title={title} subtitle={periodHint} actions={filters} />
      {showModuleNav ? (
        <ModuleSubNav links={moduleLinks} ariaLabel="Finance and KPI dashboards" />
      ) : null}
      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="page-card stack-gap dashboard-shell__body">{children}</div>
      {footer ? <footer className="page-footer muted">{footer}</footer> : null}
    </StaffPageShell>
  );
}
