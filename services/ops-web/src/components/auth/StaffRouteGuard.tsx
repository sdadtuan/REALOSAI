'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  canAccessPath,
  type StaffRouteZone,
} from '@/lib/rbac-routes';
import {
  getAccessToken,
  getStoredUser,
  syncAuthCookie,
  type StoredStaffUser,
} from '@/lib/auth';

type StaffRouteGuardProps = {
  children: React.ReactNode;
  zone: StaffRouteZone;
};

/**
 * Client cap guard (R1-S2): authenticated but missing caps → /403.
 * Login redirect is handled by middleware + missing token here.
 */
export function StaffRouteGuard({ children, zone }: StaffRouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    syncAuthCookie();

    const stored = getStoredUser();
    if (!stored) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!canAccessPath(pathname, stored, zone)) {
      router.replace(`/403?from=${encodeURIComponent(pathname)}`);
      return;
    }

    setAllowed(true);
  }, [pathname, router, zone]);

  if (!allowed) {
    return (
      <div className="route-guard-loading" aria-live="polite">
        <p className="muted">Đang kiểm tra quyền truy cập…</p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Re-check caps after staffMe refresh (optional helper for pages). */
export function assertPathCap(user: StoredStaffUser | null, pathname: string, zone: StaffRouteZone): boolean {
  return canAccessPath(pathname, user, zone);
}
