'use client';

import type { ReactNode } from 'react';
import { MetaMigrationPanel } from '@/components/MetaMigrationPanel';
import type { FacebookAdsMigrationStatus } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import { PageToolbar, StaffPageShell, type BreadcrumbItem } from '@/components/layout';

interface MetaPageShellProps {
  user: StoredStaffUser;
  onLogout: () => void;
  migration?: FacebookAdsMigrationStatus | null;
  breadcrumb?: BreadcrumbItem[];
  title?: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function MetaPageShell({
  user,
  onLogout,
  migration,
  breadcrumb,
  title,
  subtitle,
  headerExtra,
  actions,
  children,
}: MetaPageShellProps) {
  const toolbarActions = actions ?? headerExtra;

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={
        breadcrumb ?? [
          { label: 'Quảng cáo', href: '/meta/facebook-ads' },
          { label: title ?? 'Meta' },
        ]
      }
    >
      {migration ? <MetaMigrationPanel status={migration} variant="compact" /> : null}
      {title ? (
        <PageToolbar title={title} subtitle={subtitle} actions={toolbarActions} />
      ) : toolbarActions ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          {toolbarActions}
        </div>
      ) : null}
      {children}
    </StaffPageShell>
  );
}
