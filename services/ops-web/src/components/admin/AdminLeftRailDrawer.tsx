'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { AdminLeftRailNav } from '@/components/admin/AdminLeftRailNav';
import { buildAdminNavGroups } from '@/lib/admin/admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

type AdminLeftRailDrawerProps = {
  user: StoredStaffUser | null;
};

export function AdminLeftRailDrawer({ user }: AdminLeftRailDrawerProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const groups = buildAdminNavGroups(user);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, open]);

  if (!groups.length) return null;

  return (
    <>
      <button
        type="button"
        className="admin-cp-rail-trigger"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((v) => !v)}
      >
        Menu quản trị
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="admin-cp-rail-drawer-backdrop"
            aria-label="Đóng menu quản trị"
            onClick={close}
          />
          <aside id={drawerId} className="admin-cp-rail-drawer" aria-label="Menu quản trị">
            <div className="admin-cp-rail-drawer-head">
              <strong>Quản trị hệ thống</strong>
              <button type="button" className="admin-cp-rail-drawer-close" onClick={close}>
                Đóng
              </button>
            </div>
            <AdminLeftRailNav user={user} onNavigate={close} />
          </aside>
        </>
      ) : null}
    </>
  );
}
