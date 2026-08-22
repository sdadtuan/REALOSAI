'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ModuleSubNav, PageToolbar, type BreadcrumbItem } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import { portalEmailDashboard } from '@/lib/api';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import {
  buildPortalEmailModuleLinks,
  portalEmailModuleIsActive,
} from '@/lib/portal/email-module-nav';
import type { StoredUser } from '@/lib/auth';

type EmailPortalShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  hideToolbar?: boolean;
  showModuleNav?: boolean;
  children: (ctx: {
    token: string;
    user: StoredUser;
    emailPending: number;
    emailEnabled: boolean;
  }) => ReactNode;
};

function EmailPortalShellInner({
  title,
  subtitle,
  actions,
  hideToolbar,
  showModuleNav = true,
  token,
  user,
  children,
}: EmailPortalShellProps & { token: string; user: StoredUser }) {
  const { emailEnabled, pendingEmail } = usePortalEmailNav(token);
  const [workspaceOk, setWorkspaceOk] = useState(true);

  useEffect(() => {
    if (!token) return;
    void portalEmailDashboard(token)
      .then((dash) => setWorkspaceOk(dash.email_enabled !== false))
      .catch(() => setWorkspaceOk(false));
  }, [token]);

  const moduleLinks = buildPortalEmailModuleLinks(pendingEmail, user.role === 'approver');
  const enabled = emailEnabled && workspaceOk;

  return (
    <>
      {!hideToolbar ? <PageToolbar title={title} subtitle={subtitle} actions={actions} /> : null}
      {showModuleNav && enabled ? (
        <ModuleSubNav
          links={moduleLinks}
          ariaLabel="Email module"
          isActive={portalEmailModuleIsActive}
        />
      ) : null}
      {!enabled ? (
        <p className="portal-callout portal-callout--warn">
          Email chưa được kích hoạt cho client này (cần workspace).
        </p>
      ) : null}
      <div className="page-card stack-gap">
        {children({ token, user, emailPending: pendingEmail, emailEnabled: enabled })}
      </div>
    </>
  );
}

export function EmailPortalShell({
  breadcrumb,
  title,
  ...rest
}: EmailPortalShellProps) {
  return (
    <PortalPageShell
      breadcrumb={
        breadcrumb ?? [
          { label: 'Client Portal', href: '/dashboard' },
          { label: 'Email', href: '/email' },
          { label: title },
        ]
      }
    >
      {({ token, user }) => (
        <EmailPortalShellInner title={title} {...rest} token={token} user={user} />
      )}
    </PortalPageShell>
  );
}
