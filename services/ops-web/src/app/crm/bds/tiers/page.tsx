'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import { fetchBdsAgencies, postTiersRecalc } from '@/lib/bds/api';
import type { BdsAgency } from '@/lib/bds/types';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsTiersPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_agency_tiers', action: 'view' },
  ]);
  const canConfigure = hasCap(user, 'bds_agency_tiers', 'configure');

  const [rows, setRows] = useState<BdsAgency[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetchBdsAgencies(token)
      .then(setRows)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải hạng thất bại'));
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
      <HubPageLayout title="Hạng đại lý" subtitle="Tier P5">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="error">{loadError}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}

        <p className="muted">Override trên từng đại lý trong mục Mạng.</p>

        {rows.length > 0 ? (
          <table className="table-compact" style={{ marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Trạng thái</th>
                <th>Hạng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.status}</td>
                  <td>{row.tier_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Chưa có đại lý.</p>
        )}

        {canConfigure ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!token || !periodMonth.trim()) return;
              setBusy(true);
              setActionError('');
              void postTiersRecalc(token, { period_month: periodMonth.trim() })
                .then(() => fetchBdsAgencies(token).then(setRows))
                .catch((err) =>
                  setActionError(err instanceof Error ? err.message : 'Tính lại hạng thất bại'),
                )
                .finally(() => setBusy(false));
            }}
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
          >
            <input
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              placeholder="YYYY-MM"
              disabled={busy}
              style={{
                width: 140,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.55rem 0.75rem',
                color: 'var(--text)',
              }}
            />
            <button type="submit" className="btn btn-sm" disabled={busy || !periodMonth.trim()}>
              Tính lại hạng
            </button>
          </form>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
