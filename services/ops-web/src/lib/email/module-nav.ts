import { canViewEmailGateA } from '@/lib/email/caps';
import {
  emailGateAEnabled,
  emailJourneysEnabled,
  emailModuleEnabled,
} from '@/lib/email-flags';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

function navBadge(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildEmailModuleLinks(
  user: StoredStaffUser | null,
  emailPendingApprovals?: number,
): ModuleNavLink[] {
  const emailView = hasCap(user, 'crm_email_mkt', 'view') || hasCap(user, 'crm_agency', 'view');
  const emailWrite = hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');
  const emailDeliverability =
    hasCap(user, 'crm_email_mkt', 'deliverability') ||
    hasCap(user, 'crm_email_mkt', 'settings') ||
    hasCap(user, 'crm_agency', 'create');
  const emailReports =
    hasCap(user, 'crm_email_mkt', 'reports') ||
    hasCap(user, 'crm_email_mkt', 'write') ||
    hasCap(user, 'crm_agency', 'view');

  if (!emailView || !emailModuleEnabled()) return [];

  const links: ModuleNavLink[] = [
    { href: '/email/hub', label: `Hub${navBadge(emailPendingApprovals)}` },
    { href: '/email/clients', label: 'Clients' },
    { href: '/email/contacts', label: 'Contacts' },
    { href: '/email/consent', label: 'Consent' },
    { href: '/email/suppression', label: 'Suppression' },
    { href: '/email/governance', label: 'Governance' },
  ];

  if (emailWrite) {
    links.push({ href: '/email/segments', label: 'Segments' });
    links.push({ href: '/email/templates', label: 'Templates' });
    links.push({ href: '/email/campaigns', label: `Campaigns${navBadge(emailPendingApprovals)}` });
  }
  if (emailJourneysEnabled() && emailWrite) {
    links.push({ href: '/email/journeys', label: 'Journeys' });
  }
  if (emailDeliverability) {
    links.push({ href: '/email/deliverability', label: 'Deliverability' });
  }
  if (emailReports) {
    links.push({ href: '/email/reports', label: 'Reports' });
  }
  if (emailGateAEnabled() && canViewEmailGateA(user)) {
    links.push({ href: '/email/gate-a', label: 'Gate A' });
  }

  return links;
}
