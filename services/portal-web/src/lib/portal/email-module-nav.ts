import type { ModuleNavLink } from '@/lib/portal/seo-module-nav';

function badgeSuffix(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildPortalEmailModuleLinks(
  pendingEmail = 0,
  isApprover = false,
): ModuleNavLink[] {
  const links: ModuleNavLink[] = [{ href: '/email', label: 'Dashboard' }];
  if (isApprover) {
    links.push({
      href: '/email/approvals',
      label: `Approvals${badgeSuffix(pendingEmail)}`,
      badge: pendingEmail,
    });
  }
  return links;
}

export function portalEmailModuleIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/email') return false;
  return pathname.startsWith(`${href}/`);
}
