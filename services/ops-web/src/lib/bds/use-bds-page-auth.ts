'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { hasAnyCap, type CapRequirement } from '@/lib/rbac-routes';
import { isBdsUiFeEnabled } from './flags';
import { hasAnyBdsCap } from './caps';

export function useBdsPageAuth(requiredCaps: CapRequirement[]) {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!isBdsUiFeEnabled()) {
      setError('Không tìm thấy');
      return null;
    }
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
      if (!hasAnyBdsCap(me) || !hasAnyCap(me, requiredCaps)) {
        setError('Không có quyền BĐS');
        return null;
      }
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
      if (!hasAnyBdsCap(me) || !hasAnyCap(me, requiredCaps)) {
        setError('Không có quyền BĐS');
        return null;
      }
      return access;
    }
  }, [requiredCaps, router]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const access = await ensureAuth();
      setToken(access);
      setLoading(false);
    })();
  }, [ensureAuth]);

  return { user, token, error, loading, notFound: !isBdsUiFeEnabled(), logout };
}
