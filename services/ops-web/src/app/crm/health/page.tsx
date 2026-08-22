'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CsHealthDashboardPanel } from '@/components/ai/CsHealthDashboardPanel';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';

export default function CrmHealthPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canView =
    user &&
    (hasCap(user, 'crm_agency', 'view') ||
      hasCap(user, 'crm_board', 'view') ||
      hasCap(user, 'ai_admin', 'view'));

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      setToken(access);
      return access;
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
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth().catch((err) => {
      setError(err instanceof Error ? err.message : 'Auth failed');
    });
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  if (!user) {
    return (
      <main className="page-shell">
        <p className="muted">Đang xác thực…</p>
      </main>
    );
  }

  if (!canView) {
    return (
      <DashboardShell user={user} onLogout={logout} title="CS Health score" error="Không có quyền xem churn health.">
        <p className="muted">Cần crm_agency.view hoặc crm_board.view.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={logout}
      title="CS Health score"
      periodHint="Sắp xếp theo churn risk · lọc ticket spike · RNOS-19"
      error={error || undefined}
    >
      {token ? <CsHealthDashboardPanel token={token} /> : <p className="muted">Đang tải…</p>}
    </DashboardShell>
  );
}
