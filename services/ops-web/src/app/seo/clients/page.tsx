'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SeoPageShell } from '@/components/seo';
import { fetchSeoClients, staffMe, staffRefresh, type SeoHubClientRow } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { canViewSeoHub } from '@/lib/seo/caps';

export default function SeoClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [clients, setClients] = useState<SeoHubClientRow[]>([]);
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
      if (!canViewSeoHub(me)) {
        setError('Không có quyền SEO/AEO');
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
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        const data = await fetchSeoClients(access);
        setClients(data.clients);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải clients thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <SeoPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      title="SEO Clients"
      subtitle="Danh sách client SEO · workspace B1"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="muted">Đang tải…</p> : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>Domains</th>
                <th>Tier</th>
                <th>Settings</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.customer_id} id={`c${c.customer_id}`}>
                  <td>{c.customer_id}</td>
                  <td>
                    <Link href={`/seo/clients/${c.customer_id}`} className="nav-link">
                      {c.customer_name}
                    </Link>
                  </td>
                  <td>{c.domains.join(', ') || '—'}</td>
                  <td>{c.contract_tier}</td>
                  <td>{c.settings_ok ? 'OK' : 'Missing'}</td>
                  <td>
                    <span className={c.health_tier === 'bad' ? 'error' : 'muted'}>
                      {c.health_score} · {c.health_tier}
                    </span>
                  </td>
                  <td>
                    <Link href={`/seo/clients/${c.customer_id}?tab=settings`} className="btn btn-secondary btn-sm">
                      Settings
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && clients.length === 0 ? (
            <p className="muted">Chưa có dữ liệu — chạy seed SEO pilot hoặc import từ Flask PG cutover.</p>
          ) : null}
        </div>
      </div>
    </SeoPageShell>
  );
}
