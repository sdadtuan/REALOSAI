'use client';

import { type ReactNode } from 'react';
import { PageToolbar, type BreadcrumbItem } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import type { PortalSettingsResponse } from '@/lib/api';
import type { StoredUser } from '@/lib/auth';

type SettingsPortalShellProps = {
  title?: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  children: (ctx: {
    token: string;
    user: StoredUser;
    branding: PortalSettingsResponse | null;
    refreshBranding: () => Promise<void>;
  }) => ReactNode;
};

export function SettingsPortalShell({
  title = 'Cài đặt',
  subtitle = 'Thông báo, branding portal và bảo mật tài khoản',
  breadcrumb,
  children,
}: SettingsPortalShellProps) {
  return (
    <PortalPageShell
      breadcrumb={
        breadcrumb ?? [
          { label: 'Client Portal', href: '/dashboard' },
          { label: 'Cài đặt' },
        ]
      }
      width="narrow"
    >
      {(ctx) => (
        <>
          <PageToolbar title={title} subtitle={subtitle} />
          <div className="page-card stack-gap settings-page">{children(ctx)}</div>
        </>
      )}
    </PortalPageShell>
  );
}
