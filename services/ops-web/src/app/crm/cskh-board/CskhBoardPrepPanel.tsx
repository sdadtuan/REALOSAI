'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { trackLeadCallScriptCopy } from '@/lib/api';
import type { SlaCareTierSnapshot } from '@/lib/api';
import { canRunLmp, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';
import {
  fetchLeadMeetingPrep,
  runLeadMeetingPrep,
} from '@/lib/lead-meeting-prep-api';
import { CopyScriptButton } from '@/app/crm/leads/meeting-prep/CopyScriptButton';
import { buildM1Script } from '@/app/crm/leads/meeting-prep/m1-script.util';

type Props = {
  token: string;
  user: StoredStaffUser | null;
  leadId: number;
  leadLabel?: string;
  slaTiers?: SlaCareTierSnapshot[];
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

function tierPillClass(state: SlaCareTierSnapshot['sla_state']): string {
  if (state === 'breach') return 'cskh-board-tier-pill cskh-board-tier-pill--breach';
  if (state === 'warning') return 'cskh-board-tier-pill cskh-board-tier-pill--warning';
  if (state === 'ok') return 'cskh-board-tier-pill cskh-board-tier-pill--ok';
  return 'cskh-board-tier-pill';
}

export function CskhBoardPrepPanel({
  token,
  user,
  leadId,
  leadLabel,
  slaTiers = [],
  onMessage,
  onError,
}: Props) {
  const [prep, setPrep] = useState<Awaited<ReturnType<typeof fetchLeadMeetingPrep>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!leadMeetingPrepEnabled() || !canViewLmp(user)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchLeadMeetingPrep(token, leadId);
      setPrep(row);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải script thất bại');
      setPrep(null);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, user, onError]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (prep?.status === 'running' || prep?.status === 'pending') void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load, prep?.status]);

  async function onCopyTracked(text: string) {
    try {
      await trackLeadCallScriptCopy(token, leadId);
      await navigator.clipboard.writeText(text);
      onMessage?.('Đã copy script — sẵn sàng gọi');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Copy script thất bại');
    }
  }

  async function onRunPrep() {
    if (!canRunLmp(user)) return;
    setBusy(true);
    try {
      await runLeadMeetingPrep(token, leadId, { prep_stage: 'm1_first_strike', force: true });
      await load();
      onMessage?.('Đã xếp hàng prep M1');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chạy prep thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!leadMeetingPrepEnabled() || !canViewLmp(user)) {
    return (
      <p className="muted cskh-board-prep-panel">
        Lead Meeting Prep chưa bật hoặc bạn chưa có quyền xem SCI.
      </p>
    );
  }

  const status = prep?.status ?? 'none';
  const script = prep ? buildM1Script(prep) : null;
  const title = leadLabel?.trim() || `#${leadId}`;

  return (
    <section className="cskh-board-prep-panel lmp-m1-card" aria-label={`SLA + SCI — ${title}`}>
      <header className="lmp-m1-card__head">
        <div>
          <h3 className="lmp-m1-card__title">SLA + SCI · Gọi đầu — {title}</h3>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Deadline SLA + script M1 trên board
          </p>
        </div>
        <Link href={`/crm/leads/${leadId}?prep=1`} className="btn btn-sm btn-secondary">
          Talk Track →
        </Link>
      </header>

      {slaTiers.length > 0 ? (
        <div className="cskh-board-tier-inline" style={{ marginBottom: '0.75rem' }}>
          {slaTiers
            .filter((t) => t.sla_state !== 'na')
            .map((tier) => (
              <span key={tier.tier} className={tierPillClass(tier.sla_state)}>
                {tier.label}
                {tier.elapsed_minutes != null ? ` · ${tier.elapsed_minutes}p` : ''}
              </span>
            ))}
        </div>
      ) : null}

      {loading && !prep ? <p className="muted">Đang tải script…</p> : null}

      {status === 'running' || status === 'pending' ? (
        <p className="muted">AI đang research — thường 1–4 phút. Panel tự cập nhật.</p>
      ) : null}

      {status === 'awaiting_entity_choice' ? (
        <div className="banner banner-warn">
          <p>Cần chọn doanh nghiệp trước khi gọi.</p>
          <Link href={`/crm/leads/${leadId}?prep=1`} className="btn btn-sm btn-secondary">
            Chọn entity →
          </Link>
        </div>
      ) : null}

      {status === 'skipped' || status === 'failed' ? (
        <div className="banner banner-info">
          <p>{prep?.error || 'Prep chưa sẵn sàng — bổ sung tên công ty rồi chạy lại.'}</p>
          {canRunLmp(user) ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onRunPrep()}>
              Chạy prep M1
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'ready' && script?.opening ? (
        <div className="lmp-m1-card__body">
          <p className="lmp-m1-card__opening">{script.opening}</p>
          {script.questions.length > 0 ? (
            <>
              <h4 className="lmp-m1-card__sub">Câu hỏi gợi ý</h4>
              <ol className="lmp-m1-card__questions">
                {script.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </>
          ) : null}
          <div className="lmp-m1-card__actions">
            <CopyScriptButton
              text={script.fullTalkTrack || script.opening}
              label="Copy script gọi đầu"
              onCopied={() => void onCopyTracked(script.fullTalkTrack || script.opening)}
            />
          </div>
        </div>
      ) : null}

      {status === 'ready' && !script?.opening ? (
        <p className="muted">
          Prep ready —{' '}
          <Link href={`/crm/leads/${leadId}?prep=1`}>mở Talk Track</Link> để xem script đầy đủ.
        </p>
      ) : null}
    </section>
  );
}
