'use client';

import Link from 'next/link';
import { useState } from 'react';
import { applyLeadMeetingPrepOfferLadder } from '@/lib/lead-meeting-prep-api';
import type { CloseIntelligence } from './lead-meeting-prep.types';

type Props = {
  token: string;
  leadId: number;
  sci: CloseIntelligence;
  prepStage: string;
  canApplyQuote?: boolean;
  quoteBlockReason?: string;
  isGdkd?: boolean;
  sciQuoteBlocked?: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

function copyText(text: string, onMessage?: (msg: string) => void) {
  void navigator.clipboard.writeText(text).then(
    () => onMessage?.('Đã copy'),
    () => onMessage?.('Không copy được'),
  );
}

export function SalesCockpitDealReadyTab({
  token,
  leadId,
  sci,
  prepStage,
  canApplyQuote = true,
  quoteBlockReason = '',
  isGdkd = false,
  sciQuoteBlocked = false,
  onMessage,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const quoteDisabled = busy || !canApplyQuote || (sciQuoteBlocked && !isGdkd);
  const drp = sci.deal_room_payload;
  const isM3 = prepStage === 'm3_pre_close' || Boolean(drp);

  if (!isM3) {
    return (
      <div className="lmp-cockpit-tab">
        <p className="muted">
          Tab Deal Ready hiện khi prep M3 hoặc đã có deal_room_payload. Dùng nút &quot;Chuẩn bị chốt&quot; trên Cockpit để chạy M3.
        </p>
      </div>
    );
  }

  if (!drp) {
    return (
      <div className="lmp-cockpit-tab">
        <p className="muted">M3 đang chờ deal_room_payload — chạy lại prep strategize+arm.</p>
      </div>
    );
  }

  async function handleQuote() {
    const needsOverride = sciQuoteBlocked && isGdkd;
    if (needsOverride) {
      const ok = window.confirm(
        `SCI red flag block — GDKD override?\n\n${quoteBlockReason || sci.red_flags.filter((f) => f.severity === 'block').map((f) => f.flag_vi).join('; ')}`,
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const out = await applyLeadMeetingPrepOfferLadder(token, leadId, {
        gdkdOverride: needsOverride,
      });
      onMessage?.(`Proposal #${out.proposal_id} — mở editor để chỉnh`);
      window.open(out.href, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tạo báo giá thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lmp-cockpit-tab lmp-deal-ready">
      <section>
        <div className="lmp-deal-ready__head">
          <h3 className="lmp-panel__section-title">Opening narrative</h3>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => copyText(drp.opening_narrative_vi, onMessage)}
          >
            Copy
          </button>
        </div>
        <p>{drp.opening_narrative_vi}</p>
      </section>

      <section>
        <h3 className="lmp-panel__section-title">Slide bullets</h3>
        <ul>
          {drp.slide_bullets_vi.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <section>
        <div className="lmp-deal-ready__head">
          <h3 className="lmp-panel__section-title">Close ask</h3>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => copyText(drp.recommended_close_ask_vi, onMessage)}
          >
            Copy close ask
          </button>
        </div>
        <p>{drp.recommended_close_ask_vi}</p>
      </section>

      <p className="muted">
        Gói đề xuất: <strong>{drp.recommended_tier}</strong> · {drp.primary_dv_code}
      </p>

      <div className="lmp-deal-ready__actions">
        <Link href={`/crm/leads/${leadId}/deal-room`} className="btn btn-sm btn-primary">
          → Deal Room
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={quoteDisabled}
          title={quoteDisabled ? quoteBlockReason : undefined}
          onClick={() => void handleQuote()}
        >
          {busy
            ? 'Đang tạo…'
            : sciQuoteBlocked && isGdkd
              ? 'GDKD override — Quote 3 gói'
              : '→ Quote 3 gói'}
        </button>
      </div>
      {quoteBlockReason ? <p className="muted">{quoteBlockReason}</p> : null}
    </div>
  );
}
