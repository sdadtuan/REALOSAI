'use client';

import { usePathname } from 'next/navigation';
import type { PortalSettingsResponse } from '@/lib/api';
import { portalPageTitle } from '@/lib/portal/nav';
import type { StoredUser } from '@/lib/auth';

type PortalTopBarProps = {
  user: StoredUser | null;
  branding?: PortalSettingsResponse | null;
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarExpanded: boolean;
};

function userInitials(user: StoredUser | null): string {
  const name = user?.email?.trim() || '?';
  const parts = name.split(/[@.]/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function PortalTopBar({
  user,
  branding,
  onLogout,
  onToggleSidebar,
  sidebarExpanded,
}: PortalTopBarProps) {
  const pathname = usePathname();
  const pageTitle = portalPageTitle(pathname);
  const displayName = branding?.display_name ?? branding?.client_name ?? 'Client Portal';

  return (
    <header className="portal-topbar">
      <div className="portal-topbar-strip" aria-hidden="true" />
      <div className="portal-topbar-inner">
        <div className="portal-topbar-app">
          <button
            type="button"
            className="portal-sidebar-toggle portal-sidebar-toggle--topbar"
            onClick={onToggleSidebar}
            aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          >
            ☰
          </button>
          <span className="portal-topbar-app-name">{displayName}</span>
        </div>
        <div className="portal-topbar-title">
          <h1>{pageTitle}</h1>
        </div>
        <div className="portal-topbar-user">
          <div className="portal-topbar-user-meta">
            <strong>{user?.email ?? 'Client'}</strong>
            <span className="muted">{user?.role ?? 'viewer'}</span>
          </div>
          <span className="portal-topbar-avatar" aria-hidden="true">
            {userInitials(user)}
          </span>
          <button type="button" className="btn btn-sm btn-secondary btn-topbar-logout" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
