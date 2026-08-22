'use client';

import type { ReactNode } from 'react';
import { AdminLeftRailDrawer } from '@/components/admin/AdminLeftRailDrawer';
import { AdminLeftRailNav } from '@/components/admin/AdminLeftRailNav';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import type { StoredStaffUser } from '@/lib/auth';

type AdminControlPlaneLayoutProps = {
  user: StoredStaffUser | null;
  children: ReactNode;
};

export function AdminControlPlaneLayout({ user, children }: AdminControlPlaneLayoutProps) {
  const isMobile = useMediaQuery('(max-width: 900px)');

  return (
    <div className="admin-cp-layout">
      {!isMobile ? (
        <aside className="admin-cp-rail admin-cp-rail--desktop" aria-label="Quản trị hệ thống">
          <AdminLeftRailNav user={user} />
        </aside>
      ) : null}
      <div className="admin-cp-main">
        {isMobile ? <AdminLeftRailDrawer user={user} /> : null}
        {children}
      </div>
    </div>
  );
}

/** @deprecated Use AdminControlPlaneLayout — kept for direct imports during migration. */
export function AdminLeftRail({ user }: { user: StoredStaffUser | null }) {
  return (
    <aside className="admin-cp-rail admin-cp-rail--desktop" aria-label="Quản trị hệ thống">
      <AdminLeftRailNav user={user} />
    </aside>
  );
}
