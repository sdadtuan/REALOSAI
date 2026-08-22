'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { fetchBdsAgencies, fetchBdsCommissions } from '@/lib/bds/api';
import { hideCommissionSchemePct } from '@/lib/bds/caps';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

export default function BdsCommissionsPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_commission', action: 'view' },
  ]);
  const [rows, setRows] = useState<Array<{ id: string; amount_vnd: number; pct?: number }>>([]);
  const [loadError, setLoadError] = useState('');
  const hidePct = hideCommissionSchemePct(user);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const agencies = await fetchBdsAgencies(token);
        const first = agencies[0];
        if (!first) {
          setRows([]);
          return;
        }
        const period = new Date().toISOString().slice(0, 7) + '-01';
        setRows(await fetchBdsCommissions(token, first.id, period));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Tải hoa hồng thất bại');
      }
    })();
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
      <HubPageLayout title="Hoa hồng" subtitle="Ledger P7">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="muted">Chưa có dòng hoa hồng kỳ này.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>ID</th>
                {!hidePct ? <th>%</th> : null}
                <th>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id.slice(0, 8)}…</td>
                  {!hidePct ? <td>{row.pct ?? '—'}</td> : null}
                  <td>{formatVnd(row.amount_vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
