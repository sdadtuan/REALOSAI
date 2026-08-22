'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DealRoomScreenShareChecklist } from '@/components/deal-room/DealRoomScreenShareChecklist';
import { applyLeadMeetingPrepOfferLadder } from '@/lib/lead-meeting-prep-api';
import { trackLeadCallScriptCopy } from '@/lib/api';
import type { DealRoomSciSlice } from '@/lib/api';

type Props = {
  leadId: number;
  token: string;
  sci: DealRoomSciSlice;
  canCreateQuote: boolean;
  quoteBlockReason?: string;
  isGdkd?: boolean;
  sciQuoteBlocked?: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onQuoteApplied?: () => void | Promise<void>;
};

function copyText(
  text: string,
  onMessage?: (msg: string) => void,
  onTrack?: () => void | Promise<void>,
) {
  void (async () => {
    try {
      await onTrack?.();
      await navigator.clipboard.writeText(text);
      onMessage?.('Đã copy — paste vào Zalo/call notes');
    } catch {
      onMessage?.('Không copy được — chọn text thủ công');
    }
  })();
}

function formatVnd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('vi-VN')} ₫`;
}

export function DealRoomSciPanel({
  leadId,
  token,
  sci,
  canCreateQuote,
  quoteBlockReason,
  isGdkd = false,
  sciQuoteBlocked = false,
  onMessage,
  onError,
  onQuoteApplied,
}: Props) {
  const [busy, setBusy] = useState(false);
  const quoteDisabled = busy || !canCreateQuote || (sciQuoteBlocked && !isGdkd);

  async function trackSciCopy() {
    try {
      await trackLeadCallScriptCopy(token, leadId, 'sci');
    } catch {
      /* non-blocking */
    }
  }

  if (!sci.available) {
    return (
      <section className="deal-room-panel deal-room-sci deal-room-sci--empty">
        <header className="deal-room-panel__head">
          <h2 className="deal-room-panel__title">SCI — Sales Close Intelligence</h2>
        </header>
        <p className="muted">
          Chưa có prep sẵn sàng.{' '}
          <Link href={`/crm/leads/${leadId}?prep=1`}>Mở Sales Cockpit</Link> và chạy prep (M3 để có
          narrative chốt).
        </p>
      </section>
    );
  }

  async function handleApplyLadder() {
    const needsOverride = sciQuoteBlocked && isGdkd;
    if (needsOverride) {
      const ok = window.confirm(
        'SCI có red flag block. GDKD override để tạo báo giá 3 gói?\n\n' +
          (quoteBlockReason ?? sci.red_flags.filter((f) => f.severity === 'block').map((f) => f.flag_vi).join('; ')),
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const out = await applyLeadMeetingPrepOfferLadder(token, leadId, {
        gdkdOverride: needsOverride,
      });
      onMessage?.(`Đã tạo báo giá 3 gói — proposal #${out.proposal_id}`);
      await onQuoteApplied?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo báo giá từ SCI thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="deal-room-panel deal-room-sci">
      <header className="deal-room-panel__head">
        <div>
          <h2 className="deal-room-panel__title">SCI — Buổi chốt 45 phút</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            {sci.prep_stage} · Close readiness {sci.close_readiness_score ?? '—'}
            {sci.playbook_slug ? ` · Playbook ${sci.playbook_slug}` : ''}
          </p>
        </div>
        <Link href={sci.href_prep} className="btn btn-sm btn-secondary">
          Sales Cockpit
        </Link>
      </header>

      <DealRoomScreenShareChecklist leadId={leadId} />

      <div className="deal-room-sci__block">
        <div className="deal-room-sci__block-head">
          <h3>Opening narrative</h3>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => copyText(sci.opening_narrative_vi, onMessage, trackSciCopy)}
          >
            Copy
          </button>
        </div>
        <p>{sci.opening_narrative_vi || '—'}</p>
      </div>

      {sci.slide_bullets_vi.length ? (
        <div className="deal-room-sci__block">
          <div className="deal-room-sci__block-head">
            <h3>Slide bullets</h3>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => copyText(sci.slide_bullets_vi.join('\n'), onMessage, trackSciCopy)}
            >
              Copy
            </button>
          </div>
          <ul>
            {sci.slide_bullets_vi.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sci.recommended_close_ask_vi ? (
        <div className="deal-room-sci__block">
          <div className="deal-room-sci__block-head">
            <h3>Close ask</h3>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => copyText(sci.recommended_close_ask_vi, onMessage, trackSciCopy)}
            >
              Copy
            </button>
          </div>
          <p className="deal-room-sci__close-ask">{sci.recommended_close_ask_vi}</p>
        </div>
      ) : null}

      {sci.offer_ladder_summary.length ? (
        <div className="deal-room-sci__block">
          <h3>Offer ladder CB / TC / CS</h3>
          <div className="deal-room-sci-ladder">
            {sci.offer_ladder_summary.map((item) => (
              <div
                key={item.sku_code}
                className={`deal-room-sci-ladder__item${
                  item.anchor_role === 'recommended' ? ' is-recommended' : ''
                }`}
              >
                <strong>{item.tier}</strong>
                <span>{item.label_vi}</span>
                <span className="muted">{formatVnd(item.price_hint_vnd)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {sci.red_flags.length ? (
        <div className="deal-room-sci__block">
          <h3>Red flags</h3>
          <ul className="deal-room-sci-flags">
            {sci.red_flags.map((f) => (
              <li key={f.flag_vi} className={`deal-room-sci-flags__${f.severity}`}>
                <strong>{f.severity}</strong> {f.flag_vi} — {f.mitigation_vi}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="deal-room-sci__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={quoteDisabled}
          title={quoteDisabled ? quoteBlockReason : undefined}
          onClick={() => void handleApplyLadder()}
        >
          {busy
            ? 'Đang tạo…'
            : sciQuoteBlocked && isGdkd
              ? 'GDKD override — Tạo báo giá 3 gói'
              : 'Tạo báo giá 3 gói từ SCI (1-click)'}
        </button>
        {quoteBlockReason ? <p className="muted">{quoteBlockReason}</p> : null}
      </footer>
    </section>
  );
}
