'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { staffMe, staffRefresh } from '@/lib/api';
import { fetchCplDigest, type CplDigestResponse } from '@/lib/ai-api';
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
import { winCplDigestEnabled } from '@/lib/win/flags';

export default function CplDigestPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<CplDigestResponse | null>(null);
  const [error, setError] = useState('');

  const canView =
    user &&
    (hasCap(user, 'crm_ai_insights', 'view') ||
      hasCap(user, 'crm_business_dashboard', 'view') ||
      hasCap(user, 'crm_kpi_records', 'view'));

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
    void ensureAuth()
      .then(async (access) => {
        if (!access || !winCplDigestEnabled()) return;
        const me = getStoredUser();
        if (
          !me ||
          (!hasCap(me, 'crm_ai_insights', 'view') &&
            !hasCap(me, 'crm_business_dashboard', 'view') &&
            !hasCap(me, 'crm_kpi_records', 'view'))
        ) {
          return;
        }
        const digest = await fetchCplDigest(access, { days: 7 });
        setData(digest);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
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

  if (!winCplDigestEnabled()) {
    return (
      <DashboardShell user={user} onLogout={logout} title="CPL digest">
        <p className="muted">WIN-4-C CPL digest chưa bật (NEXT_PUBLIC_WIN_CPL_DIGEST).</p>
      </DashboardShell>
    );
  }

  if (!canView) {
    return (
      <DashboardShell user={user} onLogout={logout} title="CPL digest" error="Không có quyền xem CPL digest.">
        <p className="muted">Cần crm_ai_insights.view hoặc crm_business_dashboard.view.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={logout}
      title="CPL anomaly digest"
      periodHint="Tuần gần nhất · read-only · EC-W4-06"
      error={error || undefined}
    >
      {!data ? (
        <p className="muted">Đang tải narrative…</p>
      ) : (
        <div className="stack gap-md" data-testid="cpl-digest-page">
          <p className="muted">
            Kỳ {data.period.from} → {data.period.to} · không auto budget
          </p>
          <section className="card">
            <h2 className="kpi-section-title">Narrative tuần</h2>
            <p>{data.narrative}</p>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              CPL spike: {data.summary.cpl_spike_count} · Meta alerts: {data.summary.meta_open_alerts} · Zalo:{' '}
              {data.summary.zalo_open_alerts}
            </p>
          </section>
          {data.clients.map((row, idx) => (
            <section key={`${row.client_id ?? 'all'}-${idx}`} className="card">
              <h3 className="kpi-section-title">
                {row.client_id ? `Client ${row.client_id}` : 'Toàn portfolio'} · {row.channel}
              </h3>
              <p>{row.narrative}</p>
              {row.anomalies.length ? (
                <ul>
                  {row.anomalies.map((a, i) => (
                    <li key={`${a.alert_type}-${i}`}>
                      <strong>{a.severity}</strong> — {a.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Không có anomaly trong kỳ.</p>
              )}
            </section>
          ))}
          {token ? (
            <p>
              <Link href="/meta/facebook-ads" className="nav-link">
                Meta hub (budget cards) →
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </DashboardShell>
  );
}
