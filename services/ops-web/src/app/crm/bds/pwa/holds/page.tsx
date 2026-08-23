'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchProjectHolds, type BdsHoldRow } from '@/lib/bds/api';
import { BdsPwaShell } from '@/lib/bds/BdsPwaShell';
import { openHoldStatuses } from '@/lib/bds/pwa-hold-copy';
import { useBdsPwaSession } from '@/lib/bds/use-bds-pwa-session';
import { useHoldTtlLabel } from '@/lib/bds/use-hold-ttl';

function HoldTtl({ expiresAt }: { expiresAt: string | null }) {
  const label = useHoldTtlLabel(expiresAt);
  const expired = label === 'Hết hạn';
  return (
    <span className={`bds-pwa-ttl${expired ? ' bds-pwa-ttl--expired' : ''}`} aria-live="polite">
      {label}
    </span>
  );
}

function HoldCard({ row }: { row: BdsHoldRow }) {
  return (
    <li className="win-leads-mobile-card">
      <div className="win-leads-mobile-card__body">
        <div className="win-leads-mobile-card__head">
          <h3 className="win-leads-mobile-card__name">Căn #{row.product_id}</h3>
          <span className="badge">{row.status}</span>
        </div>
        <p className="win-leads-mobile-card__meta">
          Lead #{row.lead_id}
          <span className="win-leads-mobile-card__meta-sep" />
          TTL <HoldTtl expiresAt={row.expires_at} />
        </p>
        {row.note ? <p className="muted bds-pwa-hold-note">{row.note}</p> : null}
      </div>
    </li>
  );
}

export default function BdsPwaHoldsPage() {
  const { user, token, projectId, onProjectChange, error, loading, logout } = useBdsPwaSession();
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsHoldRow[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    setRows([]);
    if (!token || projectId <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoadError('');
        const data = await fetchProjectHolds(token, projectId);
        if (cancelled || projectIdRef.current !== projectId) return;
        const open = openHoldStatuses();
        setRows(data.filter((r) => open.has(String(r.status ?? '').toLowerCase())));
      } catch (err) {
        if (!cancelled && projectIdRef.current === projectId) {
          setLoadError(err instanceof Error ? err.message : 'Tải giữ chỗ thất bại');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  if (loading) {
    return (
      <main className="bds-pwa-shell bds-pwa-shell--loading">
        <p className="muted">Đang tải…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="bds-pwa-shell bds-pwa-shell--loading">
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <BdsPwaShell
      user={user}
      token={token}
      projectId={projectId}
      onProjectChange={onProjectChange}
      onLogout={logout}
      title="Giữ chỗ đang mở"
    >
      {projectId <= 0 ? <p className="muted">Chọn dự án.</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      {!loadError && projectId > 0 && rows.length === 0 ? (
        <p className="muted">Chưa có giữ chỗ pending/active.</p>
      ) : null}
      <ul className="win-leads-mobile-list" aria-label="Giữ chỗ">
        {rows.map((row) => (
          <HoldCard key={row.id} row={row} />
        ))}
      </ul>
    </BdsPwaShell>
  );
}
