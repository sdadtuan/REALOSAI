'use client';

import type { ReactNode } from 'react';
import { EmailAlertBanner } from '@/components/email/EmailAlertBanner';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import { buildEmailModuleLinks } from '@/lib/email/module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type EmailPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  emailPendingApprovals?: number;
  schemaReady?: boolean;
  showModuleNav?: boolean;
  hideToolbar?: boolean;
  width?: 'default' | 'wide' | 'narrow';
  loading?: boolean;
  children: ReactNode;
};

export function EmailPageShell({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  breadcrumb,
  emailPendingApprovals,
  schemaReady,
  showModuleNav = true,
  hideToolbar = false,
  width = 'wide',
  loading,
  children,
}: EmailPageShellProps) {
  const moduleLinks = buildEmailModuleLinks(user, emailPendingApprovals);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={breadcrumb ?? [{ label: 'Email', href: '/email/hub' }, { label: title }]}
      width={width}
      emailPendingApprovals={emailPendingApprovals}
      loading={loading}
    >
      {schemaReady === false ? (
        <EmailAlertBanner
          severity="warn"
          message="Schema email_mkt chưa apply — chạy ./scripts/apply_pg_ddl_email_mkt.sh"
          link="/email/governance"
          linkLabel="Governance"
        />
      ) : null}
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? <ModuleSubNav links={moduleLinks} ariaLabel="Email module" /> : null}
      {children}
    </StaffPageShell>
  );
}
