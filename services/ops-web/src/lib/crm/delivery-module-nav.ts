import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildCrmDeliveryModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!hasCap(user, 'crm_board', 'view')) return [];

  const links: ModuleNavLink[] = [
    { href: '/crm/marketing-plan', label: 'Marketing plan' },
    { href: '/crm/service-delivery', label: 'Triển khai DV' },
    { href: '/crm/sop', label: 'SOP' },
    { href: '/crm/launch-qa', label: 'Launch QA' },
    { href: '/crm/creatives', label: 'Creative Hub' },
    { href: '/crm/campaign-writes', label: 'Campaign Write' },
  ];
  if (isOpsDvFeEnabled()) {
    links.push(
      { href: '/crm/ops/dashboard', label: 'Ops Dashboard' },
      { href: '/crm/ops/my-tasks', label: 'Ops tasks' },
      { href: '/crm/ops/alerts', label: 'Ops alerts' },
    );
  }
  return links;
}
