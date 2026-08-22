'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildAdminNavGroups } from '@/lib/admin/admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin/crm/permissions') {
    return pathname === href;
  }
  if (href === '/admin') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminLeftRailNavProps = {
  user: StoredStaffUser | null;
  className?: string;
  onNavigate?: () => void;
};

export function AdminLeftRailNav({ user, className, onNavigate }: AdminLeftRailNavProps) {
  const pathname = usePathname() ?? '';
  const groups = buildAdminNavGroups(user);

  if (!groups.length) return null;

  return (
    <nav className={className} aria-label="Quản trị hệ thống">
      <Link
        href="/admin"
        className={`admin-cp-rail__hub${pathname === '/admin' ? ' admin-cp-rail__link--active' : ''}`}
        aria-current={pathname === '/admin' ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className="admin-cp-rail__hub-icon" aria-hidden>
          ⚙
        </span>
        <span>
          <strong>Control Plane</strong>
          <span className="muted admin-cp-rail__hub-sub">Quản trị hệ thống</span>
        </span>
      </Link>

      {groups.map((group) => (
        <div key={group.id} className="admin-cp-rail__group">
          <div className="admin-cp-rail__group-head">
            <span className="admin-cp-rail__group-label">{group.label}</span>
          </div>
          <ul className="admin-cp-rail__list">
            {group.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`admin-cp-rail__link${active ? ' admin-cp-rail__link--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
