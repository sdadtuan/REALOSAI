'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { bdsPwaActiveTab, bdsPwaTabHref, type BdsPwaTab } from '@/lib/bds/bds-pwa-nav';

const TAB_LABEL: Record<BdsPwaTab, string> = {
  leads: 'Lead',
  units: 'Căn',
  holds: 'Giữ chỗ',
};

type Props = {
  user: StoredStaffUser;
  token: string;
  projectId: number;
  onProjectChange: (id: number) => void;
  selectedLeadId?: number;
  onLogout: () => void;
  title: string;
  children: ReactNode;
};

export function BdsPwaShell({
  user,
  token,
  projectId,
  onProjectChange,
  selectedLeadId,
  onLogout,
  title,
  children,
}: Props) {
  const pathname = usePathname() ?? '';
  const active = bdsPwaActiveTab(pathname);

  return (
    <div className="bds-pwa-shell">
      <header className="bds-pwa-shell__header">
        <div className="bds-pwa-shell__header-row">
          <div>
            <p className="bds-pwa-shell__eyebrow">BĐS · PWA</p>
            <h1 className="bds-pwa-shell__title">{title}</h1>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onLogout}>
            Thoát
          </button>
        </div>
        <BdsProjectField token={token} value={projectId} onChange={onProjectChange} />
        <p className="muted bds-pwa-shell__user">{user.display_name ?? user.email}</p>
      </header>

      <main className="bds-pwa-shell__main">{children}</main>

      <nav className="bds-pwa-bottom-nav" aria-label="PWA BĐS">
        {(Object.keys(TAB_LABEL) as BdsPwaTab[]).map((tab) => (
          <Link
            key={tab}
            href={bdsPwaTabHref(tab, selectedLeadId)}
            className={`bds-pwa-bottom-nav__item${active === tab ? ' bds-pwa-bottom-nav__item--active' : ''}`}
          >
            {TAB_LABEL[tab]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
