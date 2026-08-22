'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { fetchBdsAgencies } from '@/lib/bds/api';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsAgenciesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([{ section: 'bds_agencies', action: 'view' }]);
  const [rows, setRows] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void fetchBdsAgencies(token)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải mạng thất bại'));
  }, [token]);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Mạng đại lý" subtitle="Agency P5">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="muted">Chưa có đại lý trong tenant.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
