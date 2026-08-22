'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { ServiceDeliveryKanban } from '@/components/ServiceDeliveryKanban';
import { fetchServiceLifecycles, staffMe, staffRefresh, type ServiceLifecycleRow } from '@/lib/api';
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

export default function CrmServiceDeliveryPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<ServiceLifecycleRow[]>([]);
  const [funnelStats, setFunnelStats] = useState<Record<string, number>>({});
  const [filterSlug, setFilterSlug] = useState('');
  const [filterAm, setFilterAm] = useState('');
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState(false);
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
        setError('Không có quyền service delivery');
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
      setToken(access);
      return access;
    }
  }, [router]);

  const load = useCallback(async () => {
    const access = await ensureAuth();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchServiceLifecycles(access, {
        include_draft: true,
        service_slug: filterSlug || undefined,
        am_id: filterAm || undefined,
      });
      setRows(data.lifecycles ?? []);
      setFunnelStats(data.funnel_stats ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải lifecycle thất bại');
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, filterSlug, filterAm]);

  useEffect(() => {
    void load();
  }, [load]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function notify(msg: string, isError?: boolean) {
    setToast(msg);
    setToastErr(Boolean(isError));
    window.setTimeout(() => setToast(''), 5000);
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Service Delivery — Kanban" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Service Delivery — Kanban"
      actions={
        <>
          <input
            className="kpi-input"
            placeholder="Lọc service_slug…"
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
            style={{ minWidth: 160 }}
            aria-label="Lọc service slug"
          />
          <input
            className="kpi-input"
            placeholder="Lọc AM (staff id)…"
            value={filterAm}
            onChange={(e) => setFilterAm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
            style={{ width: 120 }}
            aria-label="Lọc AM"
          />
          <button type="button" className="btn btn-sm" onClick={() => void load()}>
            Lọc
          </button>
        </>
      }
    >
      <div className="page-card stack-gap">
        {toast ? <p className={toastErr ? 'error' : undefined} style={toastErr ? undefined : { color: 'var(--accent)' }}>{toast}</p> : null}
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && rows.length === 0 ? <p className="muted">Chưa có lifecycle.</p> : null}
        {!loading && rows.length > 0 ? (
          <ServiceDeliveryKanban
            rows={rows}
            funnelStats={funnelStats}
            token={token}
            canEdit={hasCap(user, 'crm_board', 'edit')}
            onRefresh={() => void load()}
            onNotify={notify}
          />
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
