'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  fetchBdsLeads,
  fetchProjectUnits,
  postUnitHold,
  type BdsBuyerRow,
} from '@/lib/bds/api';
import type { BdsUnit } from '@/lib/bds/types';
import { BdsPwaShell } from '@/lib/bds/BdsPwaShell';
import { bdsPwaTabHref } from '@/lib/bds/bds-pwa-nav';
import { holdActionError } from '@/lib/bds/hold-copy';
import {
  filterHoldableUnits,
  holdCreateSuccessMessage,
  unitStatusLabel,
} from '@/lib/bds/pwa-hold-copy';
import { useBdsPwaSession } from '@/lib/bds/use-bds-pwa-session';

export default function BdsPwaUnitsPage() {
  const searchParams = useSearchParams();
  const leadParam = searchParams.get('lead') ?? '';
  const leadId = /^\d+$/.test(leadParam) ? Number(leadParam) : 0;

  const { user, token, projectId, onProjectChange, error, loading, logout } = useBdsPwaSession();
  const projectIdRef = useRef(projectId);
  const [lead, setLead] = useState<BdsBuyerRow | null>(null);
  const [units, setUnits] = useState<BdsUnit[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [holdingId, setHoldingId] = useState<number | null>(null);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    setLead(null);
    setUnits([]);
    setLoadError('');
    setActionError('');
    setSuccess('');
    if (!token || projectId <= 0 || leadId <= 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const [leads, allUnits] = await Promise.all([
          fetchBdsLeads(token, projectId),
          fetchProjectUnits(token, projectId),
        ]);
        if (cancelled || projectIdRef.current !== projectId) return;
        setLead(leads.find((r) => r.id === leadId) ?? null);
        setUnits(filterHoldableUnits(allUnits));
        setLoadError('');
      } catch (err) {
        if (!cancelled && projectIdRef.current === projectId) {
          setLoadError(err instanceof Error ? err.message : 'Tải căn thất bại');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, projectId, leadId]);

  const submitHold = async (unit: BdsUnit) => {
    if (!token || leadId <= 0) return;
    const rowVersion = unit.row_version ?? 0;
    setHoldingId(unit.id);
    setActionError('');
    setSuccess('');
    try {
      const hold = await postUnitHold(
        token,
        unit.id,
        { lead_id: leadId, row_version: rowVersion },
        `pwa-hold-${unit.id}-${leadId}-${Date.now()}`,
      );
      setSuccess(holdCreateSuccessMessage(unit.unit_code, hold.expires_at));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Giữ chỗ thất bại';
      setActionError(holdActionError('create', msg));
    } finally {
      setHoldingId(null);
    }
  };

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

  const leadName = lead?.full_name?.trim() || (leadId > 0 ? `Lead #${leadId}` : '');

  return (
    <BdsPwaShell
      user={user}
      token={token}
      projectId={projectId}
      onProjectChange={onProjectChange}
      selectedLeadId={leadId > 0 ? leadId : undefined}
      onLogout={logout}
      title="Chọn căn"
    >
      {leadId <= 0 ? (
        <div className="bds-pwa-callout">
          <p>Chọn lead ở tab <strong>Lead</strong> trước khi giữ căn.</p>
          <Link href={bdsPwaTabHref('leads')} className="btn btn-sm btn-primary">
            Về danh sách lead
          </Link>
        </div>
      ) : null}

      {leadId > 0 ? (
        <p className="bds-pwa-lead-banner">
          Lead: <strong>{leadName}</strong>
          {lead && !lead.full_name ? (
            <span className="muted"> (chưa tìm thấy trong dự án)</span>
          ) : null}
        </p>
      ) : null}

      {projectId <= 0 ? <p className="muted">Chọn dự án.</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}
      {success ? (
        <div className="bds-pwa-toast bds-pwa-toast--ok">
          <p>{success}</p>
          <Link href={bdsPwaTabHref('holds')} className="btn btn-sm btn-secondary">
            Xem giữ chỗ
          </Link>
        </div>
      ) : null}

      {!loadError && leadId > 0 && projectId > 0 && units.length === 0 ? (
        <p className="muted">Không còn căn trống trong dự án.</p>
      ) : null}

      <ul className="win-leads-mobile-list" aria-label="Căn trống">
        {units.map((unit) => (
          <li key={unit.id} className="win-leads-mobile-card">
            <div className="win-leads-mobile-card__body">
              <div className="win-leads-mobile-card__head">
                <h3 className="win-leads-mobile-card__name">{unit.unit_code}</h3>
                <span className="badge">{unitStatusLabel(unit.status)}</span>
              </div>
              <p className="win-leads-mobile-card__meta muted">
                {[unit.tower, unit.floor ? `Tầng ${unit.floor}` : ''].filter(Boolean).join(' · ') ||
                  '—'}
              </p>
            </div>
            <div className="win-leads-mobile-card__actions">
              <button
                type="button"
                className="win-leads-mobile-card__action win-leads-mobile-card__action--primary"
                disabled={holdingId === unit.id || leadId <= 0}
                onClick={() => void submitHold(unit)}
              >
                {holdingId === unit.id ? 'Đang giữ…' : 'Giữ'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </BdsPwaShell>
  );
}
