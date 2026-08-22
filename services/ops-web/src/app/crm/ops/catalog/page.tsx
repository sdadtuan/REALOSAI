'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { OpsCatalogPanel } from '@/components/ops/OpsCatalogPanel';
import { fetchOpsCatalog, type OpsCatalogService } from '@/lib/ops-dv-api';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
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

export default function CrmOpsCatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [services, setServices] = useState<OpsCatalogService[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền xem catalog DV');
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
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!isOpsDvFeEnabled()) {
      setError('Ops DV chưa bật (NEXT_PUBLIC_OPS_DV=1)');
      setLoading(false);
      return;
    }
    void (async () => {
      const token = await ensureAuth();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const catalog = await fetchOpsCatalog(token);
        setServices(catalog.services ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải catalog thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      title="Catalog DV01–DV21"
      subtitle="AM tư vấn combo · profile 21 dịch vụ"
      loading={loading}
    >
      {loading ? <p className="muted">Đang tải catalog…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error ? <OpsCatalogPanel services={services} /> : null}
    </CrmDeliveryPageShell>
  );
}
