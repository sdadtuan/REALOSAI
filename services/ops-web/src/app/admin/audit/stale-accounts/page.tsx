'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchStaleAccounts, type StaleAccountRow } from '@/lib/api';
import { canViewAdminAudit, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function StaleAccountsPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAdminAudit);
  const [accounts, setAccounts] = useState<StaleAccountRow[]>([]);
  const [threshold, setThreshold] = useState(90);
  const [adminOnly, setAdminOnly] = useState(false);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchStaleAccounts(token, {
        inactive_days: threshold,
        admin_only: adminOnly,
      });
      setAccounts(out.accounts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, threshold, adminOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Tài khoản không hoạt động"
      subtitle="Stale & orphaned admin report"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'Audit', href: '/admin/audit' },
        { label: 'Stale accounts' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        <div className="admin-audit-filters">
          <label>
            Ngày không login
            <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={180}>180</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} />
            Chỉ admin caps
          </label>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
            Làm mới
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Last login</th>
              <th>Risk</th>
              <th>Admin caps</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.user_id}>
                <td>{a.email}</td>
                <td>{a.last_login_at ? new Date(a.last_login_at).toLocaleDateString('vi-VN') : '—'}</td>
                <td className={a.risk === 'orphaned_admin' ? 'admin-integration-status--critical' : undefined}>
                  {a.risk}
                </td>
                <td>{a.admin_cap_count}</td>
                <td>
                  <Link href={`/admin/crm/org/users?email=${encodeURIComponent(a.email)}`} className="btn btn-sm btn-ghost">
                    Offboard
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
