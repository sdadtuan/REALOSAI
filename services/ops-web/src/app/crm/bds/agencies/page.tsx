'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import { fetchBdsAgencies, postAgency, postAgencyActivate } from '@/lib/bds/api';
import type { BdsAgency } from '@/lib/bds/types';
import { agencyActivateRole } from '@/lib/bds/actor-role';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsAgenciesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_agencies', action: 'view' },
  ]);
  const canCreate = hasCap(user, 'bds_agencies', 'create');
  const canEdit = hasCap(user, 'bds_agencies', 'edit');

  const [rows, setRows] = useState<BdsAgency[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('f1');

  const reload = async (accessToken: string) => {
    try {
      setRows(await fetchBdsAgencies(accessToken));
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải mạng thất bại');
    }
  };

  useEffect(() => {
    if (!token) return;
    void reload(token);
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
        {loadError ? <p className="error">{loadError}</p> : null}

        {canCreate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim() || !token) return;
              setBusy(true);
              void postAgency(token, { code: code.trim(), name: name.trim() || code.trim(), kind })
                .then(() => {
                  setCode('');
                  setName('');
                  return reload(token);
                })
                .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tạo thất bại'))
                .finally(() => setBusy(false));
            }}
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã" disabled={busy} style={inputStyle} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên" disabled={busy} style={inputStyle} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} style={selectStyle}>
              <option value="f1">f1</option>
              <option value="f2">f2</option>
            </select>
            <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !code.trim()}>
              + Đại lý
            </button>
          </form>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="muted">Chưa có đại lý trong tenant.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>TT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/crm/bds/agencies/${row.id}`} className="nav-link">
                      {row.code}
                    </Link>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.status}</td>
                  <td>
                    {canEdit && row.status !== 'active' ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={busy || !token}
                        onClick={() => {
                          if (!token) return;
                          setBusy(true);
                          void postAgencyActivate(token, row.id, { actor_role: agencyActivateRole() })
                            .then(() => reload(token))
                            .catch((err) =>
                              setLoadError(err instanceof Error ? err.message : 'Kích hoạt thất bại'),
                            )
                            .finally(() => setBusy(false));
                        }}
                      >
                        Kích hoạt
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 100,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;

const selectStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;
