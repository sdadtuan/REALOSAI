'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { PlaybooksLibraryPanel } from '@/components/playbooks/PlaybooksLibraryPanel';
import { staffMe, staffRefresh } from '@/lib/api';
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

export default function CrmPlaybooksPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

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
      if (!hasCap(me, 'playbooks', 'view')) {
        setError('Không có quyền playbooks.view');
        return null;
      }
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
      if (!hasCap(me, 'playbooks', 'view')) {
        setError('Không có quyền playbooks.view');
        return null;
      }
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="ai-automation" title="Playbooks" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell user={user} onLogout={logout} section="ai-automation" title="Playbooks">
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {token ? <PlaybooksLibraryPanel token={token} /> : null}
      </div>
    </AdminPageShell>
  );
}
