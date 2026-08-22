'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useAdminCrmAuth(checkAccess: (user: StoredStaffUser) => boolean) {
  const router = useRouter();
  const checkRef = useRef(checkAccess);
  checkRef.current = checkAccess;
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    void (async () => {
      let access = getAccessToken();
      if (!access) {
        router.replace('/login');
        return;
      }
      const cached = getStoredUser();
      if (cached) setUser(cached);
      try {
        let me = await staffMe(access);
        if (!checkRef.current(me)) {
          setError('Không có quyền truy cập module này');
          setLoading(false);
          return;
        }
        setUser(me);
        updateStoredUser(me);
        setToken(access);
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        if (!checkRef.current(me)) {
          setError('Không có quyền truy cập module này');
          setLoading(false);
          return;
        }
        setUser(me);
        updateStoredUser(me);
        setToken(access);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  return { user, token, error, loading, logout };
}

export function canViewOrgAdmin(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_data_config', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  );
}

export function canConfigureOrgStructure(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'configure') ||
    hasCap(user, 'crm_data_config', 'configure')
  );
}

export function canEditOrgUsers(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_staff_roster', 'edit');
}

export function canConfigureData(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_data_config', 'configure');
}

export function canViewAdminAudit(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_data_config', 'view');
}

export function canViewPolicyAdmin(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'admin_scope', 'policy') || hasCap(user, 'crm_data_config', 'view');
}

export function canViewSpcAdmin(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'spc', 'view') || hasCap(user, 'crm_data_config', 'view');
}

export function canEditSpc(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'spc', 'edit') || hasCap(user, 'crm_data_config', 'configure');
}

export function canPublishSpc(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'spc', 'publish') || hasCap(user, 'crm_data_config', 'configure');
}

export function canConfigurePolicyAdmin(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'admin_scope', 'policy') || hasCap(user, 'crm_data_config', 'configure');
}
