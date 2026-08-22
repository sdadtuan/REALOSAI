'use client';

import Link from 'next/link';
import type { LeadSlaCareContext, SlaCareTierSnapshot } from '@/lib/api';
import { trackLeadCallScriptCopy } from '@/lib/api';
import { CopyScriptButton } from '@/app/crm/leads/meeting-prep/CopyScriptButton';
import { prepStatusChipLabel } from '@/lib/lead-meeting-prep-api';

type SciSlice = NonNullable<LeadSlaCareContext['sci']>;

type Props = {
  token: string;
  leadId: number;
  slaTiers: SlaCareTierSnapshot[];
  sci: SciSlice | null | undefined;
  genericScript: LeadSlaCareContext['drafts']['call_script'];
  onOpenTalkTrack?: () => void;
  talkTrackHref?: string;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  compact?: boolean;
};

function tierPillClass(state: SlaCareTierSnapshot['sla_state']): string {
  if (state === 'breach') return 'lead-sla-tier-pill lead-sla-tier-pill--breach';
  if (state === 'warning') return 'lead-sla-tier-pill lead-sla-tier-pill--warning';
  if (state === 'ok') return 'lead-sla-tier-pill lead-sla-tier-pill--ok';
  return 'lead-sla-tier-pill lead-sla-tier-pill--na';
}

export function SlaSciCallSection({
  token,
  leadId,
  slaTiers,
  sci,
  genericScript,
  onOpenTalkTrack,
  talkTrackHref,
  onMessage,
  onError,
  compact = false,
}: Props) {
  const sciReady = sci?.enabled && sci.status === 'ready' && Boolean(sci.opening);
  const sciPending = sci?.enabled && (sci.status === 'running' || sci.status === 'pending');
  const useSci = Boolean(sciReady && sci?.script_full);

  const scriptText = useSci
    ? sci!.script_full
    : genericScript
      ? [
          genericScript.greeting,
          genericScript.intro,
          ...genericScript.questions.map((q, i) => `${i + 1}. ${q}`),
          genericScript.closing,
        ]
          .filter(Boolean)
          .join('\n\n')
      : '';

  if (!scriptText && !sciPending && !sci?.enabled) return null;

  async function onCopyTracked(text: string) {
    try {
      if (useSci) {
        await trackLeadCallScriptCopy(token, leadId);
      }
      await navigator.clipboard.writeText(text);
      onMessage?.(useSci ? 'Đã copy script SCI — sẵn sàng gọi' : 'Đã copy script.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Copy script thất bại');
    }
  }

  const prepLabel = sci?.status ? prepStatusChipLabel(sci.status as 'ready') : null;

  return (
    <div className={`sla-sci-call-section${compact ? ' sla-sci-call-section--compact' : ''}`}>
      <div className="sla-sci-call-section__head">
        <div>
          <strong className="sla-sci-call-section__title">SLA + SCI · Gọi lần đầu</strong>
          {!compact ? (
            <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
              Một panel — deadline SLA + script SCI
            </p>
          ) : null}
        </div>
        {prepLabel ? <span className="lmp-funnel-chip">{prepLabel}</span> : null}
      </div>

      {slaTiers.length > 0 ? (
        <div className="lead-sla-tier-row">
          {slaTiers
            .filter((t) => t.sla_state !== 'na')
            .map((tier) => (
              <span key={tier.tier} className={tierPillClass(tier.sla_state)} title={tier.label}>
                {tier.label}
                {tier.elapsed_minutes != null ? ` · ${tier.elapsed_minutes}p` : ''}
              </span>
            ))}
        </div>
      ) : null}

      {sciPending ? (
        <p className="muted">SCI đang research — panel tự cập nhật khi ready.</p>
      ) : null}

      {sci?.enabled && sci.status === 'awaiting_entity_choice' ? (
        <div className="banner banner-warn" style={{ marginTop: '0.5rem' }}>
          <p>Cần chọn doanh nghiệp trước khi gọi.</p>
          {onOpenTalkTrack ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onOpenTalkTrack}>
              Chọn entity →
            </button>
          ) : talkTrackHref ? (
            <Link href={talkTrackHref} className="btn btn-sm btn-secondary">
              Chọn entity →
            </Link>
          ) : null}
        </div>
      ) : null}

      {scriptText ? (
        <details className="lead-sla-script sla-sci-call-section__script" open>
          <summary>{useSci ? 'Script SCI (M1)' : 'Script gọi lần đầu (gợi ý)'}</summary>
          <pre className="lead-sla-script__body">{useSci ? sci!.opening : scriptText.slice(0, 480)}</pre>
          {!useSci && genericScript?.disclaimer ? (
            <p className="muted lead-sla-script__disclaimer">{genericScript.disclaimer}</p>
          ) : null}
          <div className="sla-sci-call-section__actions">
            <CopyScriptButton
              text={scriptText}
              label={useSci ? 'Copy script SCI' : 'Copy script'}
              onCopied={() => void onCopyTracked(scriptText)}
            />
            {onOpenTalkTrack ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={onOpenTalkTrack}>
                Mở Talk Track
              </button>
            ) : talkTrackHref ? (
              <Link href={talkTrackHref} className="btn btn-sm btn-primary">
                Mở Talk Track
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
