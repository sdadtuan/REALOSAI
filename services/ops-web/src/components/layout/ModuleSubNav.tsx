'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ModuleNavLink } from '@/lib/email/module-nav';

type ModuleSubNavProps = {
  links: ModuleNavLink[];
  ariaLabel: string;
};

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/email/hub' || href === '/seo/hub') return false;
  return pathname.startsWith(`${href}/`);
}

export function ModuleSubNav({ links, ariaLabel }: ModuleSubNavProps) {
  const pathname = usePathname();

  if (links.length === 0) return null;

  return (
    <nav className="module-sub-nav" aria-label={ariaLabel}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(pathname, link.href) ? 'active' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
