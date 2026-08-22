'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeadSlaCareContext,
  type LeadCopilotContext,
  type LeadSlaCareContext,
  type SlaCareTierSnapshot,
} from '@/lib/api';
import {
  patchAiRecommendation,
  postAiNextBestAction,
  type NextBestActionResponse,
} from '@/lib/ai-api';
import { DismissReasonModal } from '@/components/ai/DismissReasonModal';
import { SlaSciCallSection } from '@/components/crm/SlaSciCallSection';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';

interface Props {
  token: string;
  leadId: number;
  status: string;
  onAuditNoteSuggest?: (text: string) => void;
  onReload?: () => void;
  /** When set, skips GET /sla-care-context (unified copilot-context). */
  copilotContext?: LeadCopilotContext | null;
  copilotLoading?: boolean;
  onOpenMeetingPrep?: () => void;
}

function mapCopilotToSlaCare(c: LeadCopilotContext): LeadSlaCareContext {
  return {
    lead_id: c.lead_id,
    lead_flow_kind: c.lead_flow_kind,
    applicable: c.applicable,
    sla_tiers: c.sla.sla_tiers,
    worst_sla_state: c.sla.worst_sla_state,
    worst_sla_tier: c.sla.worst_sla_tier,
    banner: c.sla.banner,
    nba: c.sla.nba,
    drafts: c.sla.drafts,
    lost_reason_options: c.sla.lost_reason_options,
    sci: c.sla.sci,
  };
}

function tierPillClass(state: SlaCareTierSnapshot['sla_state']): string {
  if (state === 'breach') return 'lead-sla-tier-pill lead-sla-tier-pill--breach';
  if (state === 'warning') return 'lead-sla-tier-pill lead-sla-tier-pill--warning';
  if (state === 'ok') return 'lead-sla-tier-pill lead-sla-tier-pill--ok';
  return 'lead-sla-tier-pill lead-sla-tier-pill--na';
}

export function LeadSlaCarePanel({
  token,
  leadId,
  status,
  onAuditNoteSuggest,
  onReload,
  copilotContext,
  copilotLoading = false,
  onOpenMeetingPrep,
}: Props) {
  const [ctx, setCtx] = useState<LeadSlaCareContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [nbaBusy, setNbaBusy] = useState(false);
  const [nbaRec, setNbaRec] = useState<NextBestActionResponse['data'] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);

  const showUnifiedCallSection =
    Boolean(ctx?.drafts.call_script || ctx?.sci?.enabled) && leadMeetingPrepEnabled();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fetchLeadSlaCareContext(token, leadId);
      setCtx(out);
    } catch {
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, token]);

  useEffect(() => {
    if (copilotContext !== undefined) {
      setCtx(copilotContext ? mapCopilotToSlaCare(copilotContext) : null);
      setLoading(copilotLoading);
      return;
    }
    void reload();
  }, [copilotContext, copilotLoading, reload, status]);

  useEffect(() => {
    if (!ctx?.nba || !ctx.applicable) {
      setNbaRec(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const out = await postAiNextBestAction(token, { lead_id: leadId, entity_type: 'lead' });
        if (!cancelled) setNbaRec(out.data);
      } catch {
        if (!cancelled) setNbaRec(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx?.nba, ctx?.applicable, leadId, token]);

  if (loading) {
    return (
      <section className="lead-sla-care lead-sla-care--loading" aria-busy="true">
        <p className="muted">Đang tải SLA care…</p>
      </section>
    );
  }

  if (!ctx?.applicable) return null;

  const banner = ctx.banner;
  const showBanner = banner.severity === 'warning' || banner.severity === 'breach';
  const nba = ctx.nba;
  const callScript = ctx.drafts.call_script;
  const auditDraft = ctx.drafts.audit_note;
  const showLostReasons = status === 'lost' && ctx.lost_reason_options.length > 0;
  const showTierRow = !showUnifiedCallSection;

  function scrollToTarget(target: string) {
    const el = document.querySelector(target);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onAcceptNba() {
    if (!nbaRec) {
      if (nba) scrollToTarget(nba.cta_target);
      return;
    }
    setNbaBusy(true);
    setMessage(null);
    try {
      await patchAiRecommendation(token, nbaRec.recommendation_id, { status: 'accepted' });
      setMessage('Đã chấp nhận NBA SLA — ghi activity note.');
      if (nba) scrollToTarget(nba.cta_target);
      setNbaRec(null);
      onReload?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chấp nhận NBA thất bại');
    } finally {
      setNbaBusy(false);
    }
  }

  async function onDismissNba(reason: string) {
    if (!nbaRec) return;
    setNbaBusy(true);
    try {
      await patchAiRecommendation(token, nbaRec.recommendation_id, {
        status: 'dismissed',
        dismiss_reason: reason,
      });
      setShowDismiss(false);
      setNbaRec(null);
      setMessage('Đã bỏ gợi ý NBA.');
    } finally {
      setNbaBusy(false);
    }
  }

  function onApplyLostReason(label: string) {
    onAuditNoteSuggest?.(`Lost: ${label}`);
  }

  function onApplyAuditTemplate() {
    if (auditDraft?.template) onAuditNoteSuggest?.(auditDraft.template);
  }

  return (
    <section className="lead-sla-care" aria-label="SLA care CSKH">
      {showBanner ? (
        <div
          className={`lead-sla-banner lead-sla-banner--${banner.severity}`}
          role="status"
        >
          <strong>{banner.title}</strong>
          <p>{banner.message}</p>
        </div>
      ) : null}

      <div className={`lead-sla-tier-row${showTierRow ? '' : ' lead-sla-tier-row--hidden'}`}>
        {ctx.sla_tiers
          .filter((t) => t.sla_state !== 'na')
          .map((tier) => (
            <span key={tier.tier} className={tierPillClass(tier.sla_state)} title={tier.label}>
              {tier.label}
              {tier.elapsed_minutes != null ? ` · ${tier.elapsed_minutes}p` : ''}
            </span>
          ))}
      </div>

      {nba ? (
        <div className={`lead-sla-nba lead-sla-nba--${nba.urgency}`}>
          <div className="lead-sla-nba__body">
            <span className="lead-sla-nba__badge">NBA SLA</span>
            <strong>{nbaRec?.action_label ?? nba.action_label}</strong>
            <p className="muted">{nbaRec?.reason ?? nba.reason}</p>
          </div>
          <div className="lead-sla-nba__actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={nbaBusy}
              onClick={() => void onAcceptNba()}
            >
              {nbaBusy ? 'Đang xử lý…' : 'Thực hiện'}
            </button>
            {nbaRec ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={nbaBusy}
                onClick={() => setShowDismiss(true)}
              >
                Bỏ
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <p className="lead-sla-care__message">{message}</p> : null}

      {showUnifiedCallSection ? (
        <SlaSciCallSection
          token={token}
          leadId={leadId}
          slaTiers={ctx.sla_tiers}
          sci={ctx.sci}
          genericScript={callScript}
          onOpenTalkTrack={onOpenMeetingPrep}
          talkTrackHref={`/crm/leads/${leadId}?prep=1`}
          onMessage={setMessage}
          onError={setMessage}
        />
      ) : callScript ? (
        <details className="lead-sla-script">
          <summary>Script gọi lần đầu (gợi ý)</summary>
          <pre className="lead-sla-script__body">
            {[callScript.greeting, callScript.intro, ...callScript.questions.map((q, i) => `${i + 1}. ${q}`), callScript.closing]
              .filter(Boolean)
              .join('\n\n')}
          </pre>
          <p className="muted lead-sla-script__disclaimer">{callScript.disclaimer}</p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(
                  [callScript.greeting, callScript.intro, ...callScript.questions.map((q, i) => `${i + 1}. ${q}`), callScript.closing]
                    .filter(Boolean)
                    .join('\n\n'),
                )
                .then(() => setMessage('Đã copy script.'))
            }
          >
            Copy script
          </button>
        </details>
      ) : null}

      {status === 'chot' && auditDraft ? (
        <div className="lead-sla-audit-suggest">
          <span className="muted">Gợi ý audit note:</span>
          <code className="lead-sla-audit-suggest__template">{auditDraft.template}</code>
          <ul className="muted lead-sla-audit-suggest__hints">
            {auditDraft.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onApplyAuditTemplate}>
            Dùng mẫu audit
          </button>
        </div>
      ) : null}

      {showLostReasons ? (
        <div className="lead-sla-lost-reasons">
          <span className="lead-sla-lost-reasons__label">Gợi ý lý do lost:</span>
          <div className="lead-sla-lost-reasons__chips">
            {ctx.lost_reason_options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="lead-sla-lost-chip"
                title={`Độ tin cậy ${Math.round(opt.confidence * 100)}%`}
                onClick={() => onApplyLostReason(opt.label)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DismissReasonModal
        open={showDismiss}
        busy={nbaBusy}
        onCancel={() => setShowDismiss(false)}
        onConfirm={(reason) => void onDismissNba(reason)}
      />
    </section>
  );
}
