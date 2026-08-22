'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeadMeetingPrep,
  runLeadMeetingPrep,
} from '@/lib/lead-meeting-prep-api';
import type { LeadMeetingPrepResponse } from './lead-meeting-prep.types';
import { fetchLeadPresalesConsultBrief, trackLeadCallScriptCopy } from '@/lib/api';
import { canRunLmp, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import { CopyScriptButton } from './CopyScriptButton';
import { BantQualifyChecklist } from './BantQualifyChecklist';
import { buildM2HandoffBrief, buildSolutionCallBriefText } from './m2-handoff.util';

type Props = {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  show: boolean;
  intakeHref: string;
  onOpenMeetingPrep?: () => void;
  onOpenConsultTab?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export function M2QualifyHandoffCard({
  token,
  leadId,
  user,
  show,
  intakeHref,
  onOpenMeetingPrep,
  onOpenConsultTab,
  onMessage,
  onError,
}: Props) {
  const [prep, setPrep] = useState<LeadMeetingPrepResponse | null>(null);
  const [bantTotal, setBantTotal] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<string>('');
  const [closeBrief, setCloseBrief] = useState('');
  const [externalResearch, setExternalResearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadMeetingPrepEnabled() || !canViewLmp(user)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [prepRow, briefOut] = await Promise.all([
        fetchLeadMeetingPrep(token, leadId),
        fetchLeadPresalesConsultBrief(token, leadId).catch(() => null),
      ]);
      setPrep(prepRow);
      const brief = briefOut?.brief as Record<string, unknown> | undefined;
      if (brief) {
        const readiness = brief.readiness as Record<string, unknown> | undefined;
        setBantTotal(Number(readiness?.bant_total ?? 0) || null);
        setTemperature(String(readiness?.temperature_label ?? '').trim());
        setCloseBrief(String(brief.close_brief ?? '').trim());
        setExternalResearch(String(brief.external_research_summary ?? '').trim());
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải M2 prep thất bại');
      setPrep(null);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, user, onError]);

  useEffect(() => {
    if (!show) {
      setLoading(false);
      return;
    }
    void load();
    const t = setInterval(() => {
      if (prep?.status === 'running' || prep?.status === 'pending') void load();
    }, 8000);
    return () => clearInterval(t);
  }, [show, load, prep?.status]);

  if (!show || !leadMeetingPrepEnabled() || !canViewLmp(user)) return null;

  async function onCopyTracked(text: string) {
    try {
      await trackLeadCallScriptCopy(token, leadId);
      await navigator.clipboard.writeText(text);
      onMessage?.('Đã copy brief / talk track M2');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Copy thất bại');
    }
  }

  async function onCopySolutionBrief() {
    const brief = buildM2HandoffBrief(prep!);
    const text = buildSolutionCallBriefText({
      externalResearch,
      closeBrief,
      painBasis: brief.painBasis,
      bantTotal: bantTotal ?? undefined,
      temperatureLabel: temperature,
    });
    await onCopyTracked(text);
  }

  async function onRunM2Prep() {
    if (!canRunLmp(user)) return;
    setBusy(true);
    try {
      await runLeadMeetingPrep(token, leadId, { prep_stage: 'm2_qualify_win', force: true });
      await load();
      onMessage?.('Đã xếp hàng prep M2');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chạy prep M2 thất bại');
    } finally {
      setBusy(false);
    }
  }

  const status = prep?.status ?? 'none';
  const handoff = prep ? buildM2HandoffBrief(prep) : null;

  return (
    <section className="lmp-m2-card" aria-labelledby="lmp-m2-title">
      <header className="lmp-m2-card__head">
        <div>
          <h3 id="lmp-m2-title" className="lmp-m2-card__title">
            M2 · Qualify &amp; handoff Solution
          </h3>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Sau BANT Go — brief pain/ROI trước cuộc gọi Solution
            {bantTotal != null ? ` · BANT ${bantTotal}/30` : ''}
            {temperature ? ` · ${temperature}` : ''}
          </p>
        </div>
        <div className="lmp-m2-card__head-actions">
          {onOpenMeetingPrep ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onOpenMeetingPrep}>
              Sales Cockpit
            </button>
          ) : null}
          {onOpenConsultTab ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenConsultTab}>
              Consult brief
            </button>
          ) : null}
        </div>
      </header>

      <BantQualifyChecklist leadId={leadId} />

      {loading && !prep ? <p className="muted">Đang tải prep M2…</p> : null}

      {status === 'running' || status === 'pending' ? (
        <p className="muted">SCI đang refresh sau Intake — thường 1–3 phút.</p>
      ) : null}

      {status === 'skipped' || status === 'failed' ? (
        <div className="banner banner-info">
          <p>{prep?.error || 'Chưa có prep M2 — hoàn thành Intake Go hoặc chạy lại prep.'}</p>
          {canRunLmp(user) ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onRunM2Prep()}>
              Chạy prep M2
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'ready' && handoff?.painBasis ? (
        <div className="lmp-m2-card__body">
          {handoff.readiness != null ? (
            <p className="lmp-m2-card__readiness">
              Close readiness: <strong>{handoff.readiness}</strong>/100
            </p>
          ) : null}
          <p className="lmp-m2-card__pain">{handoff.painBasis}</p>
          {handoff.urgencyLines.length > 0 ? (
            <ul className="lmp-m2-card__urgency muted">
              {handoff.urgencyLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {externalResearch ? (
            <details className="lmp-m2-card__research">
              <summary>Research DN (Tavily)</summary>
              <p>{externalResearch.slice(0, 400)}{externalResearch.length > 400 ? '…' : ''}</p>
            </details>
          ) : null}
          <div className="lmp-m2-card__actions">
            {handoff.opening ? (
              <CopyScriptButton
                text={handoff.fullTalkTrack || handoff.opening}
                label="Copy talk track M2"
                onCopied={() => void onCopyTracked(handoff.fullTalkTrack || handoff.opening)}
              />
            ) : null}
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onCopySolutionBrief()}>
              Copy brief Solution call
            </button>
          </div>
          <ul className="lmp-m1-checklist muted">
            <li>
              <Link href={intakeHref}>Hoàn thiện BANT</Link> nếu chưa Go
            </li>
            <li>Đọc Intel + Objections trên Cockpit</li>
            <li>Handoff Solution khi gate consult OK</li>
          </ul>
        </div>
      ) : null}

      {status === 'ready' && !handoff?.painBasis ? (
        <p className="muted">Prep M2 ready — mở Sales Cockpit để xem brief đầy đủ.</p>
      ) : null}
    </section>
  );
}
