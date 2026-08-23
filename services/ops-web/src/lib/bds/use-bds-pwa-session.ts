'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { readBdsProjectId, writeBdsProjectId } from '@/lib/bds/project-picker';

export function useBdsPwaSession() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    void (async () => {
      let access = getAccessToken();
      if (!access) {
        router.replace('/login?next=/crm/bds/pwa');
        return;
      }
      setToken(access);
      const cached = getStoredUser();
      if (cached) setUser(cached);
      try {
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'bds_holds', 'create')) {
          setError('Chỉ TVV / sale có quyền giữ chỗ mới dùng PWA này.');
          return;
        }
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login?next=/crm/bds/pwa');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        setToken(access);
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'bds_holds', 'create')) {
          setError('Chỉ TVV / sale có quyền giữ chỗ mới dùng PWA này.');
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onProjectChange = useCallback((id: number) => {
    writeBdsProjectId(id);
    setProjectId(id);
  }, []);

  return { user, token, projectId, onProjectChange, error, loading, logout };
}
