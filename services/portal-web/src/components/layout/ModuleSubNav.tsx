'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ModuleNavLink } from '@/lib/portal/seo-module-nav';

type ModuleSubNavProps = {
  links: ModuleNavLink[];
  ariaLabel: string;
  isActive?: (pathname: string, href: string) => boolean;
};

function defaultIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ModuleSubNav({ links, ariaLabel, isActive = defaultIsActive }: ModuleSubNavProps) {
  const pathname = usePathname();
  const visible = links.filter((link) => !link.hidden);
  if (visible.length === 0) return null;

  return (
    <nav className="module-sub-nav" aria-label={ariaLabel}>
      {visible.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(pathname, link.href) ? 'active' : undefined}
        >
          {link.label}
          {link.badge != null && link.badge > 0 ? (
            <span className="module-sub-nav__badge">{link.badge > 99 ? '99+' : link.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
