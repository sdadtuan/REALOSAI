'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchSpcPortfolio, type SpcPortfolioItem } from '@/lib/spc-api';
import { canViewSpcAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

function readinessLabel(r: string): string {
  if (r === 'ready') return 'Sẵn sàng';
  if (r === 'partial') return 'Một phần';
  if (r === 'gap') return 'Gap';
  return r;
}

export default function AdminServicesPortfolioPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const [items, setItems] = useState<SpcPortfolioItem[]>([]);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchSpcPortfolio(token);
      setItems(out.items ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải portfolio thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Portfolio 21 DV"
      subtitle="L0 service_family — trạng thái SKU published / draft"
      section="crm-config"
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog', href: '/admin/services' },
        { label: 'Portfolio' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      <div className="page-card">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên dịch vụ</th>
              <th>Bộ phận</th>
              <th>Readiness</th>
              <th>SKU</th>
              <th>Draft</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.dv_code}>
                <td>
                  <strong>{row.dv_code}</strong>
                </td>
                <td>{row.name_vi}</td>
                <td>{row.department || '—'}</td>
                <td>{readinessLabel(row.readiness)}</td>
                <td>
                  {row.published_count}/3 published
                </td>
                <td>{row.draft_count > 0 ? `${row.draft_count} draft` : '—'}</td>
                <td>
                  <Link href={`/admin/services/families/${row.dv_code}`}>Chi tiết →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
