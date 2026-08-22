'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import {
  acknowledgeOpsAlert,
  fetchOpsAlerts,
  runOpsAgentScan,
  type OpsAlertItem,
} from '@/lib/ops-dv-api';
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

export default function CrmOpsAlertsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [items, setItems] = useState<OpsAlertItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const canEdit = Boolean(user && hasCap(user, 'crm_board', 'edit'));

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
        setError('Không có quyền xem cảnh báo');
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

  const load = useCallback(async (access: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchOpsAlerts(access, { status: 'open', limit: 100 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải cảnh báo thất bại');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpsDvFeEnabled()) {
      setError('Ops DV chưa bật (NEXT_PUBLIC_OPS_DV).');
      return;
    }
    void ensureAuth().then((access) => {
      if (access) void load(access);
    });
  }, [ensureAuth, load]);

  async function onAck(alertId: number) {
    const access = await ensureAuth();
    if (!access || !canEdit) return;
    setBusy(alertId);
    try {
      await acknowledgeOpsAlert(access, alertId);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận thất bại');
    } finally {
      setBusy(null);
    }
  }

  async function onRunAgent(dryRun: boolean) {
    const access = await ensureAuth();
    if (!access || !canEdit) return;
    setLoading(true);
    try {
      await runOpsAgentScan(access, dryRun);
      await load(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chạy Ops Agent thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      title="Trung tâm cảnh báo Ops"
      subtitle="L2 Ops Agent — task due/overdue + KPI"
      loading={loading}
      actions={
        canEdit ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void onRunAgent(true)}>
              Dry run
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void onRunAgent(false)}>
              Chạy scan
            </button>
          </div>
        ) : null
      }
    >
      {error ? <p className="error">{error}</p> : null}
      {items.length === 0 ? (
        <p className="muted">Không có cảnh báo mở.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
          {items.map((alert) => (
            <li
              key={alert.id}
              style={{ border: '1px solid var(--border, #ddd)', borderRadius: 8, padding: '0.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <strong>{alert.title}</strong>
                  <p className="muted" style={{ margin: '0.25rem 0' }}>
                    {alert.message}
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {alert.dv_code} · lifecycle{' '}
                    <Link
                      href={`/crm/service-delivery/${alert.lifecycle_id}?tab=ops-hub`}
                      className="nav-link"
                    >
                      #{alert.lifecycle_id}
                    </Link>
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={busy === alert.id}
                    onClick={() => void onAck(alert.id)}
                  >
                    Đã xử lý
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CrmDeliveryPageShell>
  );
}
