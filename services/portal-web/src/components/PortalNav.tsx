'use client';

/**
 * @deprecated Prefer `PortalPageShell` — kept for SEO/Email pages until P5 migration.
 */
import { PortalAppNav } from '@/components/layout';
import type { PortalSettingsResponse } from '@/lib/api';
import type { StoredUser } from '@/lib/auth';

interface PortalNavProps {
  user: StoredUser | null;
  onLogout: () => void;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  branding?: PortalSettingsResponse | null;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
}

export function PortalNav(props: PortalNavProps) {
  return <PortalAppNav {...props} />;
}
