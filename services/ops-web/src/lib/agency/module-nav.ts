import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

function navBadge(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildAgencyModuleLinks(
  user: StoredStaffUser | null,
  agencyUnread?: number,
): ModuleNavLink[] {
  if (!hasCap(user, 'crm_agency', 'view')) return [];

  return [
    { href: '/agency', label: 'Agency' },
    { href: '/agency/ingest', label: 'Ingest' },
    { href: '/agency/jobs', label: 'Jobs' },
    { href: '/agency/notifications', label: `Thông báo${navBadge(agencyUnread)}` },
    { href: '/agency/kpi-definitions', label: 'KPI definitions' },
  ];
}
