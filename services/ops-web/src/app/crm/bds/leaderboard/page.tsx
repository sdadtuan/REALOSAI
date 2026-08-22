'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { fetchBdsLeaderboard } from '@/lib/bds/api';
import type { LeaderboardRow } from '@/lib/bds/types';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsLeaderboardPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_agency_tiers', action: 'view' },
  ]);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void fetchBdsLeaderboard(token)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải bảng xếp hạng thất bại'));
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
      <HubPageLayout title="Bảng xếp hạng" subtitle="Điểm hạng tháng">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {!loading && !error && rows.length === 0 ? (
          <p className="muted">Chưa có điểm kỳ này.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>Đại lý</th>
                <th>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agency_id}>
                  <td>{row.name}</td>
                  <td>{row.total_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
