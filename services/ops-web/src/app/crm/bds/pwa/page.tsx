'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { fetchBdsLeads, type BdsBuyerRow } from '@/lib/bds/api';
import { BdsPwaShell } from '@/lib/bds/BdsPwaShell';
import { bdsPwaTabHref } from '@/lib/bds/bds-pwa-nav';
import { useBdsPwaSession } from '@/lib/bds/use-bds-pwa-session';

function leadLabel(row: BdsBuyerRow): string {
  return row.full_name?.trim() || `Lead #${row.id}`;
}

export default function BdsPwaLeadsPage() {
  const router = useRouter();
  const { user, token, projectId, onProjectChange, error, loading, logout } = useBdsPwaSession();
  const projectIdRef = useRef(projectId);
  const [rows, setRows] = useState<BdsBuyerRow[]>([]);
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
        const data = await fetchBdsLeads(token, projectId);
        if (!cancelled && projectIdRef.current === projectId) setRows(data);
      } catch (err) {
        if (!cancelled && projectIdRef.current === projectId) {
          setLoadError(err instanceof Error ? err.message : 'Tải lead thất bại');
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
      title="Chọn lead"
    >
      {projectId <= 0 ? (
        <p className="muted">Chọn dự án để xem lead.</p>
      ) : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      {!loadError && projectId > 0 && rows.length === 0 ? (
        <p className="muted">Chưa có lead cho dự án này.</p>
      ) : null}
      <ul className="win-leads-mobile-list" aria-label="Lead re_buyer">
        {rows.map((row) => {
          const phone = row.phone?.trim();
          const phoneDigits = phone?.replace(/\D/g, '') ?? '';
          return (
            <li
              key={row.id}
              className="win-leads-mobile-card"
              role="button"
              tabIndex={0}
              onClick={() => router.push(bdsPwaTabHref('units', row.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(bdsPwaTabHref('units', row.id));
                }
              }}
            >
              <div className="win-leads-mobile-card__body">
                <div className="win-leads-mobile-card__head">
                  <h3 className="win-leads-mobile-card__name">{leadLabel(row)}</h3>
                  <div className="win-leads-mobile-card__badges">
                    <span className="badge">{row.status || 'moi'}</span>
                  </div>
                </div>
                {phone ? (
                  <p className="win-leads-mobile-card__meta">
                    <span>{phone}</span>
                  </p>
                ) : null}
              </div>
              <div className="win-leads-mobile-card__actions">
                {phoneDigits ? (
                  <a
                    className="win-leads-mobile-card__action"
                    href={`tel:${phoneDigits}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Gọi
                  </a>
                ) : null}
                <Link
                  href={bdsPwaTabHref('units', row.id)}
                  className="win-leads-mobile-card__action win-leads-mobile-card__action--primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  Chọn căn
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </BdsPwaShell>
  );
}
