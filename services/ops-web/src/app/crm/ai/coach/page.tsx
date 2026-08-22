'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoachDigestPanel } from '@/components/ai/CoachDigestPanel';
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

export default function CrmAiCoachPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canView =
    user &&
    (hasCap(user, 'crm_kpi_records', 'view') ||
      hasCap(user, 'crm_business_dashboard', 'view') ||
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
      <DashboardShell user={user} onLogout={logout} title="Manager Coach" error="Không có quyền xem coach digest.">
        <p className="muted">Cần crm_kpi_records.view hoặc crm_business_dashboard.view.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={logout}
      title="Manager Coach digest"
      periodHint="Thứ 2 08:00 · SLA + AI acceptance + pipeline · UI-R3-05"
      error={error || undefined}
    >
      {token ? <CoachDigestPanel token={token} /> : <p className="muted">Đang tải…</p>}
    </DashboardShell>
  );
}
