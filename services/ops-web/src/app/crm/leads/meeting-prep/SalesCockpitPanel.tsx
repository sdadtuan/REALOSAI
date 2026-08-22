'use client';

import { useState } from 'react';
import { submitLeadMeetingPrepFeedback } from '@/lib/lead-meeting-prep-api';
import { canRunLmp, hasCap, type StoredStaffUser } from '@/lib/auth';
import { sciBlocksQuoteForUser } from '@/lib/lmp-red-flag-block.util';
import { prepStageSubtitle } from '@/lib/lmp-stage-labels';
import { CloseReadinessGauge } from './CloseReadinessGauge';
import { LeadMeetingPrepEntityPicker } from './LeadMeetingPrepEntityPicker';
import { LeadMeetingPrepProgress } from './LeadMeetingPrepProgress';
import {
  SalesCockpitIntelTab,
  SalesCockpitObjectionsTab,
  SalesCockpitOfferTab,
  SalesCockpitTalkTrackTab,
} from './SalesCockpitTabs';
import { SalesCockpitDealReadyTab } from './SalesCockpitDealReadyTab';
import { SalesCockpitObjectionsPin } from './SalesCockpitObjectionsPin';
import type { LeadMeetingPrepResponse } from './lead-meeting-prep.types';

type Props = {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  prep: LeadMeetingPrepResponse;
  busy: boolean;
  onRun: (force?: boolean) => void;
  onPrepareClose?: () => void;
  onPickEntity: (entityId: string) => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

const TABS = [
  { id: 'intel', label: 'Intel' },
  { id: 'talk', label: 'Talk Track' },
  { id: 'offer', label: 'Offer Ladder' },
  { id: 'objections', label: 'Objections' },
  { id: 'deal', label: 'Deal Ready' },
] as const;

export function SalesCockpitPanel({
  token,
  leadId,
  user,
  prep,
  busy,
  onRun,
  onPrepareClose,
  onPickEntity,
  onMessage,
  onError,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>(() =>
    prep.prep_stage === 'm1_first_strike' || prep.prep_stage === 'm2_qualify_win' ? 'talk' : 'intel',
  );
  const sci = prep.result?.close_intelligence;
  const canRun = canRunLmp(user);
  const showDealReady =
    prep.prep_stage === 'm3_pre_close' || Boolean(sci?.deal_room_payload);
  const showObjectionsPin =
    prep.prep_stage === 'm3_pre_close' || Boolean(sci?.deal_room_payload);
  const visibleTabs = showDealReady ? TABS : TABS.filter((t) => t.id !== 'deal');
  const isGdkd = hasCap(user, 'crm_leads', 'assign');
  const sciQuoteBlock = sciBlocksQuoteForUser(sci?.red_flags, isGdkd);
  const hasSciBlockFlags = Boolean(sci?.red_flags?.some((f) => f.severity === 'block'));

  async function onFeedback(helpful: boolean) {
    try {
      await submitLeadMeetingPrepFeedback(token, leadId, { helpful });
      onMessage?.(helpful ? 'Cảm ơn feedback 👍' : 'Đã ghi nhận feedback 👎');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gửi feedback thất bại');
    }
  }

  return (
    <section id="lmp-panel" className="lmp-panel lmp-cockpit">
      <header className="lmp-panel__head">
        <div>
          <h2 className="lmp-panel__title">Sales Cockpit</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            {prep.status_label_vi} · {prepStageSubtitle(prep.prep_stage)}
          </p>
        </div>
        <CloseReadinessGauge score={prep.close_readiness_score} breakdown={prep.readiness_breakdown} />
      </header>

      <LeadMeetingPrepProgress
        status={prep.status}
        stepsCompleted={prep.progress?.steps_completed}
        message={prep.progress?.message_vi}
      />

      {prep.status === 'awaiting_entity_choice' && prep.entity_candidates?.length ? (
        <LeadMeetingPrepEntityPicker
          candidates={prep.entity_candidates}
          busy={busy}
          onSelect={onPickEntity}
        />
      ) : null}

      {prep.status === 'ready' && sci && prep.result ? (
        <>
          <nav className="lmp-cockpit-tabs" aria-label="Sales Cockpit tabs">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'is-active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className={`lmp-cockpit-body${showObjectionsPin ? ' lmp-cockpit-body--with-pin' : ''}`}>
            {tab === 'intel' ? <SalesCockpitIntelTab result={prep.result} sci={sci} /> : null}
            {tab === 'talk' ? (
              <SalesCockpitTalkTrackTab
                sci={sci}
                leadId={leadId}
                token={token}
                prepStage={prep.prep_stage}
                onMessage={onMessage}
              />
            ) : null}
            {tab === 'offer' ? <SalesCockpitOfferTab sci={sci} /> : null}
            {tab === 'objections' ? <SalesCockpitObjectionsTab sci={sci} /> : null}
            {tab === 'deal' && sci ? (
              <SalesCockpitDealReadyTab
                token={token}
                leadId={leadId}
                sci={sci}
                prepStage={prep.prep_stage}
                canApplyQuote={!sciQuoteBlock.blocked}
                quoteBlockReason={sciQuoteBlock.reason}
                isGdkd={isGdkd}
                sciQuoteBlocked={hasSciBlockFlags}
                onMessage={onMessage}
                onError={onError}
              />
            ) : null}
            {showObjectionsPin && tab !== 'objections' ? (
              <SalesCockpitObjectionsPin sci={sci} />
            ) : null}
          </div>
          <footer className="lmp-cockpit-foot">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onFeedback(true)}>
              👍 Hữu ích
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onFeedback(false)}>
              👎 Chưa ổn
            </button>
            {canRun ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy}
                  onClick={() => onPrepareClose?.()}
                >
                  Chuẩn bị chốt
                </button>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onRun(true)}>
                  Chạy lại
                </button>
              </>
            ) : null}
          </footer>
        </>
      ) : prep.status === 'ready' && prep.result && !sci ? (
        <p className="muted">Prep sẵn sàng (P0) — chưa có Close Intelligence. Chạy lại prep để nâng cấp SCI.</p>
      ) : null}

      {(prep.status === 'pending' || prep.status === 'running') && (
        <p className="muted">AI đang research — thường 1,5–4 phút.</p>
      )}
    </section>
  );
}
