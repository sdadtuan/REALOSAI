'use client';

import { useEffect, useState } from 'react';
import type { CreativeRow } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { PortalSwipeActions } from '@/components/mobile/PortalSwipeActions';

interface CreativeInboxProps {
  rows: CreativeRow[];
  canApprove: boolean;
  focusCreativeId?: string | null;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note: string) => Promise<void>;
}

function CreativeAssetPreview({ row }: { row: CreativeRow }) {
  if (!row.asset_url) {
    return null;
  }
  const isImage = row.asset_type === 'image' || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(row.asset_url);
  if (isImage) {
    return (
      <div className="creative-card__asset">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={row.asset_url} alt={row.title} />
      </div>
    );
  }
  return (
    <p className="muted creative-card__desc">
      Asset:{' '}
      <a href={row.asset_url} target="_blank" rel="noreferrer">
        mở preview ({row.asset_type || 'file'})
      </a>
    </p>
  );
}

export function CreativeInbox({ rows, canApprove, focusCreativeId, onApprove, onReject }: CreativeInboxProps) {
  const { push } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!focusCreativeId) return;
    const el = document.getElementById(`creative-${focusCreativeId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (rows.some((r) => r.id === focusCreativeId)) {
      setConfirmId(focusCreativeId);
    }
  }, [focusCreativeId, rows]);

  if (rows.length === 0) {
    return (
      <div className="card portal-empty-state">
        <p className="portal-empty-state__title">Không có creative đang chờ duyệt</p>
        <p className="muted portal-empty-state__hint">
          AM sẽ gửi creative mới qua workflow Launch QA khi sẵn sàng.
        </p>
      </div>
    );
  }

  async function handleApprove(id: string, title: string) {
    setBusyId(id);
    setError('');
    try {
      await onApprove(id);
      setConfirmId(null);
      push(`Đã duyệt "${title}"`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Duyệt thất bại';
      setError(message);
      push(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string, title: string) {
    setBusyId(id);
    setError('');
    try {
      await onReject(id, rejectNote);
      setRejectId(null);
      setRejectNote('');
      push(`Đã từ chối "${title}"`, 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Từ chối thất bại';
      setError(message);
      push(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="creative-inbox-list">
      {error ? <p className="error">{error}</p> : null}
      {rows.map((row) => (
        <PortalSwipeActions
          key={row.id}
          onSwipeLeft={
            canApprove && row.status === 'pending_client'
              ? () => setConfirmId(row.id)
              : undefined
          }
          onSwipeRight={
            canApprove && row.status === 'pending_client'
              ? () => {
                  setRejectId(row.id);
                  setRejectNote('');
                }
              : undefined
          }
        >
          <article
            id={`creative-${row.id}`}
            className={`creative-card${focusCreativeId === row.id ? ' creative-card--focus' : ''}`}
          >
            <div className="creative-card__head">
              <div className="creative-card__main">
                <h3 className="creative-card__title">{row.title}</h3>
                <p className="muted creative-card__meta">
                  v{row.version}
                  {row.external_campaign_name ? ` · ${row.external_campaign_name}` : ''}
                  {' · '}
                  gửi {fmtDate(row.submitted_at.slice(0, 10))}
                </p>
                {row.description ? <p className="creative-card__desc">{row.description}</p> : null}
                <CreativeAssetPreview row={row} />
              </div>
              {canApprove && row.status === 'pending_client' ? (
                <div className="creative-card__actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === row.id}
                    onClick={() => setConfirmId(row.id)}
                  >
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setRejectId(row.id);
                      setRejectNote('');
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              ) : null}
            </div>
            {confirmId === row.id ? (
              <div className="portal-approval-panel">
                <p>Xác nhận duyệt creative này? Hành động sẽ đồng bộ Launch QA.</p>
                <div className="portal-approval-panel__actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === row.id}
                    onClick={() => void handleApprove(row.id, row.title)}
                  >
                    Xác nhận duyệt
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmId(null)}>
                    Huỷ
                  </button>
                </div>
              </div>
            ) : null}
            {rejectId === row.id ? (
              <div className="portal-approval-panel">
                <label htmlFor={`reject-${row.id}`}>Lý do từ chối (tuỳ chọn)</label>
                <textarea
                  id={`reject-${row.id}`}
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
                <div className="portal-approval-panel__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === row.id}
                    onClick={() => void handleReject(row.id, row.title)}
                  >
                    Gửi từ chối
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setRejectId(null)}>
                    Huỷ
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </PortalSwipeActions>
      ))}
    </div>
  );
}
