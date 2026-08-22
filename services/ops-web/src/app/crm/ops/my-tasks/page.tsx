'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { OpsSpecialistDashboardPanel } from '@/components/ops/OpsDashboardPanels';
import { fetchOpsDashboardSpecialist, type OpsDashboardSpecialistPayload } from '@/lib/ops-dv-api';
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

export default function CrmOpsMyTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [data, setData] = useState<OpsDashboardSpecialistPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        setError('Không có quyền xem task');
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
      setError('Ops DV chưa bật (NEXT_PUBLIC_OPS_DV).');
      return;
    }
    void ensureAuth().then(async (access) => {
      if (!access) return;
      setLoading(true);
      try {
        setData(await fetchOpsDashboardSpecialist(access));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải task thất bại');
      } finally {
        setLoading(false);
      }
    });
  }, [ensureAuth]);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      title="Task của tôi"
      subtitle="Checklist tuần Ops DV (pending)"
      loading={loading}
    >
      {error ? <p className="error">{error}</p> : null}
      {data ? <OpsSpecialistDashboardPanel data={data} /> : null}
    </CrmDeliveryPageShell>
  );
}
