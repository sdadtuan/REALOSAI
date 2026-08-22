'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  PageFooter,
  PageToolbar,
  StaffPageShell,
} from '@/components/layout';
import { fetchCustomers, staffMe, staffRefresh, type CustomerRow } from '@/lib/api';
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

export default function CrmCustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
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
      if (!hasCap(me, 'crm_board_customers', 'view')) {
        setError('Không có quyền xem khách hàng');
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
      setError('');
      try {
        const data = await fetchCustomers(access, { q: query || undefined, limit: 200 });
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải khách hàng thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, query]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Khách hàng', href: '/crm/customers' },
        { label: 'Danh sách' },
      ]}
    >
      <PageToolbar
        title="Khách hàng"
        subtitle={`${rows.length.toLocaleString('vi-VN')} khách hàng`}
      />

      <div className="page-card stack-gap">
        <FilterBar onSubmit={onSearch}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm tên, SĐT, email, công ty…" />
          <FilterBarActions>
            <button className="btn btn-sm btn-secondary" type="submit" disabled={loading}>
              Lọc
            </button>
          </FilterBarActions>
        </FilterBar>

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>SĐT</th>
                <th>Email</th>
                <th>Công ty</th>
                <th>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/crm/customers/${c.id}`} className="nav-link">
                      {c.id}
                    </Link>
                  </td>
                  <td>{c.name || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{c.company || '—'}</td>
                  <td>{c.lead_source_label || c.lead_source || '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Không có khách hàng
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PageFooter meta={`Hiển thị ${rows.length.toLocaleString('vi-VN')} khách hàng`} />
      </div>
    </StaffPageShell>
  );
}
