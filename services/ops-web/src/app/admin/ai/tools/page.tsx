'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AiToolKeysPanel } from '@/components/ai/AiToolKeysPanel';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function AdminAiToolsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const authorize = useCallback((me: StoredStaffUser): boolean => {
    if (!hasCap(me, 'ai_admin', 'view')) {
      setError('Không có quyền AI admin (ai_admin.view)');
      return false;
    }
    setUser(me);
    updateStoredUser(me);
    return true;
  }, []);

  const ensureAuth = useCallback(async (): Promise<void> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    try {
      const me = await staffMe(access);
      if (authorize(me)) setToken(access);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const refreshed = await staffRefresh(refresh);
        access = refreshed.access_token;
        updateAccessToken(access);
        const me = await staffMe(access);
        if (authorize(me)) setToken(access);
      } catch {
        clearSession();
        router.replace('/login');
      }
    }
  }, [authorize, router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="ai-automation" title="AI tool keys" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell user={user} onLogout={logout} section="ai-automation" title="AI tool keys">
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {token ? <AiToolKeysPanel token={token} /> : null}
      </div>
    </AdminPageShell>
  );
}
