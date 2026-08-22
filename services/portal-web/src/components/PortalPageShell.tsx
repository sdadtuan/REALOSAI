'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PortalMobileBottomNav } from '@/components/PortalMobileBottomNav';
import { PortalAppNav, PortalPage, type BreadcrumbItem } from '@/components/layout';
import {
  fetchPendingCreativeCount,
  fetchPortalNotificationSummary,
  fetchPortalSettings,
  portalSeoStatus,
  type PortalNotificationSummaryResponse,
  type PortalSettingsResponse,
} from '@/lib/api';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import { applyPortalBranding, clearPortalBranding } from '@/lib/portal/branding';

interface PortalPageShellProps {
  children: (ctx: {
    token: string;
    user: NonNullable<ReturnType<typeof usePortalAuth>['user']>;
    branding: PortalSettingsResponse | null;
    refreshBranding: () => Promise<void>;
  }) => ReactNode;
  breadcrumb?: BreadcrumbItem[];
  width?: 'default' | 'wide' | 'narrow';
}

export function PortalPageShell({ children, breadcrumb, width = 'wide' }: PortalPageShellProps) {
  const { user, token, loading, sessionWarning, logout } = usePortalAuth();
  const seoEnabled = usePortalSeoNav(token);
  const { emailEnabled, pendingEmail } = usePortalEmailNav(token);
  const [pendingCount, setPendingCount] = useState(0);
  const [seoPending, setSeoPending] = useState(0);
  const [notificationSummary, setNotificationSummary] = useState<PortalNotificationSummaryResponse | null>(
    null,
  );
  const [branding, setBranding] = useState<PortalSettingsResponse | null>(null);

  const refreshBranding = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchPortalSettings(token);
      setBranding(data);
    } catch {
      setBranding(null);
    }
  }, [token]);

  useEffect(() => {
    if (branding) {
      applyPortalBranding(branding);
      return () => clearPortalBranding();
    }
    clearPortalBranding();
  }, [branding]);

  useEffect(() => {
    if (!token) return;
    void fetchPendingCreativeCount(token).then(setPendingCount).catch(() => setPendingCount(0));
    void refreshBranding();
    void fetchPortalNotificationSummary(token)
      .then(setNotificationSummary)
      .catch(() => setNotificationSummary(null));
    if (seoEnabled) {
      void portalSeoStatus(token)
        .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
        .catch(() => setSeoPending(0));
    } else {
      setSeoPending(0);
    }
  }, [token, seoEnabled, refreshBranding]);

  if (loading || !user || !token) {
    return (
      <main className="portal-page portal-page--wide">
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <>
      <PortalAppNav
        user={user}
        onLogout={logout}
        pendingCount={pendingCount}
        notificationUnread={notificationSummary?.unread ?? 0}
        emailPending={pendingEmail}
        seoPending={seoPending}
        branding={branding}
        seoEnabled={seoEnabled}
        emailEnabled={emailEnabled}
      />
      <PortalPage breadcrumb={breadcrumb} width={width}>
        {sessionWarning ? <p className="badge portal-session-warning">{sessionWarning}</p> : null}
        {children({ token, user, branding, refreshBranding })}
      </PortalPage>
      <PortalMobileBottomNav
        pendingCreatives={pendingCount}
        notificationUnread={notificationSummary?.unread ?? 0}
        emailPending={pendingEmail}
        emailEnabled={emailEnabled}
        isApprover={user.role === 'approver'}
      />
    </>
  );
}
