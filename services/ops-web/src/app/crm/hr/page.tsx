'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { HrHubExpiryWidgets } from '@/components/hr/HrHubExpiryWidgets';
import { HrAttendanceHubWidgets } from '@/components/hr/HrAttendanceHubWidgets';
import { HrGpsPendingQueue } from '@/components/hr/HrGpsPendingQueue';
import { HrPendingWalletQueue } from '@/components/hr/HrPendingWalletQueue';
import { buildHrHubGroups, canViewHrHub } from '@/lib/crm/hr-hub';
import { downloadHrWalletAccountingXlsx } from '@/lib/hr-employee-file-api';
import { hasCap } from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function CrmHrHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async (): Promise<StoredStaffUser | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    setToken(access);
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewHrHub(me)) {
        setError('Không có quyền truy cập module Nhân sự');
        return null;
      }
      return me;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      setToken(access);
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewHrHub(me)) {
        setError('Không có quyền truy cập module Nhân sự');
        return null;
      }
      return me;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const groups = buildHrHubGroups(user);

  return (
    <CrmHrPageShell
      user={user}
      onLogout={logout}
      title="HR Hub"
      subtitle="Workforce & Performance — onboard, chấm công, KPI gắn CRM"
      showModuleNav={false}
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {token && user && !error ? <HrHubExpiryWidgets token={token} /> : null}
        {token && user && !error ? <HrAttendanceHubWidgets token={token} /> : null}
        {token && user && !error ? <HrGpsPendingQueue token={token} user={user} /> : null}
        {token && user && !error ? <HrPendingWalletQueue token={token} user={user} /> : null}
        {token && user && hasCap(user, 'crm_hr_docs', 'view') ? (
          <p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() =>
                void downloadHrWalletAccountingXlsx(token).catch((err) =>
                  setError(err instanceof Error ? err.message : 'Export thất bại'),
                )
              }
            >
              Export Excel ví + NPT (kế toán)
            </button>
          </p>
        ) : null}
        {!error && groups.length === 0 && user ? (
          <p className="muted">Chưa có workspace HR nào khả dụng với quyền hiện tại.</p>
        ) : null}

        {groups.map((group) => (
          <section key={group.id} className="stack-gap">
            <div>
              <h2 className="section-title">{group.title}</h2>
              <p className="muted">{group.subtitle}</p>
            </div>
            <div className="hub-module-grid">
              {group.cards.map((card) => {
                const inner = (
                  <>
                    <span className="muted">{card.description}</span>
                    <strong>
                      {card.label}
                      {card.badge ? (
                        <span className="hub-module-card__badge" style={{ marginLeft: '0.5rem' }}>
                          {card.badge}
                        </span>
                      ) : null}
                    </strong>
                  </>
                );
                if (card.planned || !card.href) {
                  return (
                    <div
                      key={card.id}
                      className="summary-card hub-module-card"
                      style={{ opacity: 0.72, cursor: 'default' }}
                      aria-disabled="true"
                    >
                      {inner}
                    </div>
                  );
                }
                return (
                  <Link key={card.id} href={card.href} className="summary-card hub-module-card">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <p className="muted" style={{ fontSize: '0.875rem' }}>
          Module lương nội bộ — export cho kế toán MISA/FAST. Không thay phần mềm BHXH/thuế TNCN.
        </p>
      </div>
    </CrmHrPageShell>
  );
}
