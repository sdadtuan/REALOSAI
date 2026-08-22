'use client';

import { useState } from 'react';
import { createDealRoomTeaser, revokeDealRoomTeaser } from '@/lib/api';

interface Props {
  leadId: number;
  token: string;
  canShare: boolean;
  blockReason?: string;
  teaserActive: boolean;
  teaserExpiresAt?: string | null;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onUpdated?: () => void | Promise<void>;
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('vi-VN');
}

export function DealRoomTeaserPanel({
  leadId,
  token,
  canShare,
  blockReason,
  teaserActive,
  teaserExpiresAt,
  onMessage,
  onError,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState('');

  async function handleCreate() {
    if (!canShare || busy) return;
    setBusy(true);
    onError?.('');
    try {
      const out = await createDealRoomTeaser(token, leadId);
      setLastUrl(out.url);
      await navigator.clipboard.writeText(out.url);
      onMessage?.(`Đã tạo link Portal · hết hạn ${formatExpiry(out.expires_at)} · đã copy clipboard`);
      await onUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo link Portal thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!canShare || busy || !teaserActive) return;
    if (!window.confirm('Thu hồi link Portal teaser hiện tại?')) return;
    setBusy(true);
    onError?.('');
    try {
      await revokeDealRoomTeaser(token, leadId);
      setLastUrl('');
      onMessage?.('Đã thu hồi link Portal teaser');
      await onUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Thu hồi link thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLast() {
    if (!lastUrl) return;
    await navigator.clipboard.writeText(lastUrl);
    onMessage?.('Đã copy link Portal');
  }

  const title = canShare
    ? 'Chia sẻ bản xem trước L1 cho khách (không giá)'
    : blockReason || 'Hoàn thành G4 R5 và bật PTT_DEAL_ROOM_PORTAL_TEASER';

  return (
    <section className="deal-room-panel deal-room-panel--teaser" aria-label="Portal teaser">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">Portal teaser</h3>
        {teaserActive ? (
          <span className="deal-room-badge deal-room-badge--ok">Link active</span>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Link read-only trên portal.pttads.vn — North Star + 3 khối chiến lược, không giá nội bộ. TTL 14 ngày.
      </p>
      {teaserActive && teaserExpiresAt ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          Link đang active · hết hạn {formatExpiry(teaserExpiresAt)}
        </p>
      ) : null}
      {lastUrl ? (
        <p className="deal-room-teaser-url" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          {lastUrl}
        </p>
      ) : null}
      <div className="deal-room-actions" style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!canShare || busy}
          title={title}
          onClick={() => void handleCreate()}
        >
          {busy ? 'Đang tạo…' : 'Tạo & copy link Portal'}
        </button>
        {lastUrl ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void handleCopyLast()}>
            Copy link
          </button>
        ) : null}
        {teaserActive ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={!canShare || busy}
            onClick={() => void handleRevoke()}
          >
            Thu hồi link
          </button>
        ) : null}
      </div>
    </section>
  );
}
