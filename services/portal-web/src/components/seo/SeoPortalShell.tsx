'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ModuleSubNav, PageToolbar, type BreadcrumbItem } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import { portalSeoStatus } from '@/lib/api';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import {
  buildPortalSeoModuleLinks,
  portalSeoModuleIsActive,
} from '@/lib/portal/seo-module-nav';
import type { StoredUser } from '@/lib/auth';

type SeoPortalShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  hideToolbar?: boolean;
  showModuleNav?: boolean;
  children: (ctx: {
    token: string;
    user: StoredUser;
    seoPending: number;
    seoEnabled: boolean;
  }) => ReactNode;
};

function SeoPortalShellInner({
  title,
  subtitle,
  actions,
  hideToolbar,
  showModuleNav = true,
  token,
  user,
  children,
}: SeoPortalShellProps & { token: string; user: StoredUser }) {
  const seoEnabled = usePortalSeoNav(token);
  const [seoPending, setSeoPending] = useState(0);

  useEffect(() => {
    if (!token || !seoEnabled) {
      setSeoPending(0);
      return;
    }
    void portalSeoStatus(token)
      .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
      .catch(() => setSeoPending(0));
  }, [token, seoEnabled]);

  const moduleLinks = buildPortalSeoModuleLinks(seoPending);

  return (
    <>
      {!hideToolbar ? <PageToolbar title={title} subtitle={subtitle} actions={actions} /> : null}
      {showModuleNav && seoEnabled ? (
        <ModuleSubNav
          links={moduleLinks}
          ariaLabel="SEO module"
          isActive={portalSeoModuleIsActive}
        />
      ) : null}
      {!seoEnabled ? (
        <p className="portal-callout portal-callout--warn">
          SEO chưa được kích hoạt hoặc chưa map workspace cho client này.
        </p>
      ) : null}
      <div className="page-card stack-gap">{children({ token, user, seoPending, seoEnabled })}</div>
    </>
  );
}

export function SeoPortalShell({
  breadcrumb,
  title,
  ...rest
}: SeoPortalShellProps) {
  return (
    <PortalPageShell
      breadcrumb={
        breadcrumb ?? [
          { label: 'Client Portal', href: '/dashboard' },
          { label: 'SEO / AEO', href: '/seo' },
          { label: title },
        ]
      }
    >
      {({ token, user }) => <SeoPortalShellInner title={title} {...rest} token={token} user={user} />}
    </PortalPageShell>
  );
}
