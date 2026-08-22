export type ModuleNavLink = {
  href: string;
  label: string;
  badge?: number;
  hidden?: boolean;
};

function badgeSuffix(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildPortalSeoModuleLinks(seoPending = 0): ModuleNavLink[] {
  return [
    { href: '/seo', label: 'Dashboard' },
    { href: '/seo/reports', label: 'Báo cáo' },
    {
      href: '/seo/content',
      label: `Content review${badgeSuffix(seoPending)}`,
      badge: seoPending,
    },
  ];
}

export function portalSeoModuleIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/seo') return false;
  return pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
}
