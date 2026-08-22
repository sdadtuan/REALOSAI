'use client';

import { useEffect, useState } from 'react';
import type { PortalSettingsResponse } from '@/lib/api';
import type { StoredUser } from '@/lib/auth';
import {
  PortalSidebar,
  applyShellClasses,
  readSidebarExpanded,
  SIDEBAR_STORAGE_KEY,
} from './PortalSidebar';
import { PortalTopBar } from './PortalTopBar';

export type PortalAppNavProps = {
  user: StoredUser | null;
  onLogout: () => void;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  branding?: PortalSettingsResponse | null;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
};

export function PortalAppNav(props: PortalAppNavProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    const expanded = readSidebarExpanded();
    setSidebarExpanded(expanded);
    applyShellClasses(expanded);
  }, []);

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      }
      applyShellClasses(next);
      return next;
    });
  }

  return (
    <>
      <PortalSidebar {...props} sidebarExpanded={sidebarExpanded} onToggleSidebar={toggleSidebar} />
      <PortalTopBar
        user={props.user}
        branding={props.branding}
        onLogout={props.onLogout}
        onToggleSidebar={toggleSidebar}
        sidebarExpanded={sidebarExpanded}
      />
    </>
  );
}
