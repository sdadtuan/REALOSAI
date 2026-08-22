'use client';

import { useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchBdsLaunches,
  fetchBdsWarRoom,
  postCloseLaunch,
  postOpenLaunch,
  type LaunchRow,
} from '@/lib/bds/api';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

const STATUS_LABEL: Record<LaunchRow['status'], string> = {
  draft: 'Nháp',
  open: 'Đang mở',
  closed: 'Đã đóng',
};

type WarRoom = Awaited<ReturnType<typeof fetchBdsWarRoom>>;

export default function BdsLaunchesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_launches', action: 'view' },
  ]);
  const [rows, setRows] = useState<LaunchRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warRoom, setWarRoom] = useState<WarRoom | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const canOpen = hasCap(user, 'bds_launches', 'open');

  const reload = async (accessToken: string) => {
    setRows(await fetchBdsLaunches(accessToken));
  };

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await reload(token);
      } catch (err) {
        setLoadError(
          err instanceof Error && err.message.includes('404')
            ? 'Ra quân chưa bật'
            : err instanceof Error
              ? err.message
              : 'Tải ra quân thất bại',
        );
      }
    })();
  }, [token]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!token || !selected || selected.status !== 'open') {
      setWarRoom(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchBdsWarRoom(token, selected.id);
        if (!cancelled) setWarRoom(next);
      } catch {
        if (!cancelled) setWarRoom(null);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, selected]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Ra quân" subtitle="Giữ chỗ · hàng đợi · xung đột (SCR-BDS-070)">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="muted">{actionError}</p> : null}
        {!loading && !error && !loadError && rows.length === 0 ? (
          <p className="muted">Chưa có sự kiện ra quân.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="table-compact">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>TTL</th>
                <th>Giá</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === row.id ? '#f5f5f5' : undefined,
                  }}
                >
                  <td>{row.project_id}</td>
                  <td>{row.hold_ttl_seconds}s</td>
                  <td>{row.price_list_id ?? '—'}</td>
                  <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {selected && token ? (
          <section style={{ marginTop: '1.5rem' }}>
            <h3>Ra quân {selected.id.slice(0, 8)}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {selected.status === 'draft' && canOpen ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void runAction(() => postOpenLaunch(token, selected.id))}
                >
                  Mở ra quân
                </button>
              ) : null}
              {selected.status === 'open' && canOpen ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void runAction(() => postCloseLaunch(token, selected.id))}
                >
                  Đóng
                </button>
              ) : null}
            </div>
            {selected.status === 'open' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div>
                  <h4>Giữ chỗ</h4>
                  {(warRoom?.holds ?? []).length === 0 ? (
                    <p className="muted">Không có hold.</p>
                  ) : (
                    <ul>
                      {(warRoom?.holds ?? []).map((h) => (
                        <li key={h.hold_id}>
                          Căn {h.product_id} · {h.status}
                          {h.ttl_remaining_sec != null ? ` · ${h.ttl_remaining_sec}s` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4>Hàng đợi</h4>
                  {(warRoom?.queues ?? []).length === 0 ? (
                    <p className="muted">Trống.</p>
                  ) : (
                    <ul>
                      {(warRoom?.queues ?? []).map((q) => (
                        <li key={q.id}>
                          Căn {q.product_id} · lead {q.lead_id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4>Xung đột</h4>
                  {(warRoom?.conflicts ?? []).length === 0 ? (
                    <p className="muted">Không có.</p>
                  ) : (
                    <ul>
                      {(warRoom?.conflicts ?? []).map((c) => (
                        <li key={c.product_id}>
                          Căn {c.product_id} · {c.waiting} chờ
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
