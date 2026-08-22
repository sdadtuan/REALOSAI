'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchSpcHub, type SpcHubStats } from '@/lib/spc-api';
import { canViewSpcAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

export default function AdminServicesHubPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewSpcAdmin);
  const [stats, setStats] = useState<SpcHubStats | null>(null);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      setStats(await fetchSpcHub(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải hub SPC thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      title="Dịch vụ & Catalog (SPC)"
      subtitle="Service Product Catalog — portfolio DV21, SKU CB/TC/CS, publish workflow"
      section="crm-config"
      loading={loading}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Dịch vụ & Catalog' },
      ]}
    >
      {error ? <p className="error">{error}</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      {stats ? (
        <div className="admin-grid-cards" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="page-card">
            <div className="muted">Portfolio</div>
            <strong style={{ fontSize: '1.6rem' }}>{stats.family_count}</strong>
            <div className="muted">DV families</div>
          </div>
          <div className="page-card">
            <div className="muted">SKU published</div>
            <strong style={{ fontSize: '1.6rem' }}>{stats.published_skus}</strong>
            <div className="muted">CB / TC / CS live</div>
          </div>
          <div className="page-card">
            <div className="muted">Draft chờ publish</div>
            <strong style={{ fontSize: '1.6rem' }}>{stats.draft_offers}</strong>
            <div className="muted">PO chỉnh sửa</div>
          </div>
          <div className="page-card">
            <div className="muted">Pilot DV</div>
            <strong>{stats.pilot_dv.join(', ')}</strong>
          </div>
        </div>
      ) : null}

      <div className="page-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Quick actions</h3>
        <ul className="stack-gap" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li>
            <Link href="/admin/services/portfolio">Portfolio 21 DV</Link> — xem / sửa SKU theo DV
          </li>
          <li>
            <Link href="/admin/services/process">Process phases (L3)</Link> — spawn-week theo DVxx-Tn / SKU
          </li>
          <li>
            <Link href="/admin/services/publish">Publish queue</Link> — IT publish draft → ops profile sync
          </li>
          <li>
            <Link href="/crm/ops/catalog">Ops catalog (read-only)</Link> — AM tra cứu published SKU
          </li>
        </ul>
      </div>
    </AdminPageShell>
  );
}
