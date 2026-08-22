'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { fetchInvoices, staffMe, staffRefresh, type InvoiceRow } from '@/lib/api';
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

export function InvoicesContent() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [showOverdue, setShowOverdue] = useState(false);
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
      if (!hasCap(me, 'crm_business_dashboard', 'view')) {
        setError('Không có quyền hóa đơn');
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

  const load = useCallback(async () => {
    const access = await ensureAuth();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchInvoices(access, { overdue: showOverdue });
      setRows(out.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hóa đơn thất bại');
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, showOverdue]);

  useEffect(() => {
    void load();
  }, [load]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Hóa đơn (RNOS-25)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Hóa đơn (RNOS-25)"
      subtitle="Invoice + AR aging — CRM-UC-006 bước 10 · SVC-UC-004 E1"
    >
      <div className="page-card stack-gap">
        <label className="renewal-agent-card__channel">
          <input type="checkbox" checked={showOverdue} onChange={(e) => setShowOverdue(e.target.checked)} />
          {' '}Chỉ overdue
        </label>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="renewal-agent-panel__error">{error}</p> : null}
        <div className="data-table-wrap" data-testid="invoices-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Số HĐ</th>
                <th>KH</th>
                <th>Due</th>
                <th>Trạng thái</th>
                <th>Amount</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid={`invoice-row-${row.id}`}>
                  <td>{row.invoice_number}</td>
                  <td>#{row.customer_id}</td>
                  <td>{row.due_on || '—'}</td>
                  <td>{row.status}</td>
                  <td>{row.amount_vnd.toLocaleString('vi-VN')} ₫</td>
                  <td>{row.paid_vnd.toLocaleString('vi-VN')} ₫</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length ? <p className="muted">Chưa có hóa đơn.</p> : null}
        </div>
      </div>
    </CrmDeliveryPageShell>
  );
}
