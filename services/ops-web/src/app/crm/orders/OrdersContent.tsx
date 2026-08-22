'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { fetchOrders, staffMe, staffRefresh, type OrderRow } from '@/lib/api';
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

export function OrdersContent() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
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
        setError('Không có quyền đơn hàng');
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
        const out = await fetchOrders(access);
        setRows(out.orders);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải đơn hàng thất bại');
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
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Bán hàng', href: '/crm/orders' },
        { label: 'Đơn hàng' },
      ]}
    >
      <PageToolbar
        title="Đơn hàng"
        subtitle="Sales order từ proposal/HĐ — CRM-UC-006 bước 9"
      />

      <div className="page-card stack-gap">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="data-table-wrap" data-testid="orders-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã SO</th>
                <th>KH</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
                <th>Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid={`order-row-${row.id}`}>
                  <td>{row.reference_code}</td>
                  <td>#{row.customer_id}</td>
                  <td>{row.order_date}</td>
                  <td>{row.status}</td>
                  <td>{row.total_vnd.toLocaleString('vi-VN')} ₫</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length ? <p className="muted">Chưa có đơn hàng.</p> : null}
        </div>
      </div>
    </StaffPageShell>
  );
}
