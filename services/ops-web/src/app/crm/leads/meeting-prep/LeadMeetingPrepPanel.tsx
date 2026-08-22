'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchLeadMeetingPrep,
  prepareLeadMeetingClose,
  runLeadMeetingPrep,
  selectLeadMeetingPrepEntity,
} from '@/lib/lead-meeting-prep-api';
import { canRunLmp, canViewLmp, type StoredStaffUser } from '@/lib/auth';
import { LeadMeetingPrepEntityPicker } from './LeadMeetingPrepEntityPicker';
import { LeadMeetingPrepProgress } from './LeadMeetingPrepProgress';
import { SalesCockpitPanel } from './SalesCockpitPanel';
import { PostCallDebriefModal } from './PostCallDebriefModal';
import type { LeadMeetingPrepResponse } from './lead-meeting-prep.types';

type Props = {
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  leadStatus?: string | null;
  autoFocus?: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onStatusChange?: (status: LeadMeetingPrepResponse['status']) => void;
};

function confidenceLabel(conf?: string): string {
  switch (conf) {
    case 'verified':
      return 'Đã xác minh';
    case 'provided':
      return 'AM cung cấp';
    case 'likely':
      return 'Có khả năng';
    case 'cross_verified':
      return 'Xác minh chéo';
    default:
      return 'Chưa xác minh';
  }
}

export function LeadMeetingPrepPanel({
  token,
  leadId,
  user,
  leadStatus,
  autoFocus,
  onMessage,
  onError,
  onStatusChange,
}: Props) {
  const [prep, setPrep] = useState<LeadMeetingPrepResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [debriefOpen, setDebriefOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canView = canViewLmp(user);
  const canRun = canRunLmp(user);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      const row = await fetchLeadMeetingPrep(token, leadId);
      setPrep(row);
      onStatusChange?.(row.status);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải prep thất bại');
    } finally {
      setLoading(false);
    }
  }, [canView, token, leadId, onError, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const status = prep?.status;
    if (status === 'running' || status === 'pending') {
      pollRef.current = setInterval(() => {
        void load();
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [prep?.status, load]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = document.getElementById('lmp-panel');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [autoFocus]);

  const terminalStatus = String(leadStatus ?? '').trim().toLowerCase();
  const showDebriefPrompt =
    (terminalStatus === 'chot' || terminalStatus === 'lost') && prep?.debrief_pending;

  useEffect(() => {
    if (showDebriefPrompt) setDebriefOpen(true);
  }, [showDebriefPrompt]);

  async function onRun(force = false) {
    if (!canRun) {
      onError?.('Không có quyền crm_lmp.run');
      return;
    }
    setBusy(true);
    try {
      const out = await runLeadMeetingPrep(token, leadId, {
        force,
        website_url: websiteUrl.trim() || undefined,
      });
      setPrep(out.prep);
      onStatusChange?.(out.prep.status);
      onMessage?.(out.enqueued ? 'Đã xếp hàng prep' : 'Prep không enqueue (xem trạng thái)');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chạy prep thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onPickEntity(entityId: string) {
    setBusy(true);
    try {
      const out = await selectLeadMeetingPrepEntity(token, leadId, entityId);
      setPrep(out.prep);
      onStatusChange?.(out.prep.status);
      onMessage?.('Đã chọn doanh nghiệp — prep tiếp tục');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chọn entity thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <div className="lmp-panel banner banner-warn">
        Không có quyền xem Lead Meeting Prep (<code>crm_lmp.view</code>).
      </div>
    );
  }

  if (loading && !prep) {
    return <div className="lmp-panel muted">Đang tải prep…</div>;
  }

  const status = prep?.status ?? 'none';
  const result = prep?.result;

  async function onPrepareClose() {
    if (!canRun) {
      onError?.('Không có quyền crm_lmp.run');
      return;
    }
    setBusy(true);
    try {
      const out = await prepareLeadMeetingClose(token, leadId);
      setPrep(out.prep);
      onStatusChange?.(out.prep.status);
      onMessage?.(out.enqueued ? 'Đã xếp hàng M3 — Chuẩn bị chốt' : 'M3 không enqueue');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Chuẩn bị chốt thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (prep && status === 'ready' && result?.close_intelligence) {
    return (
      <>
        <SalesCockpitPanel
          token={token}
          leadId={leadId}
          user={user}
          prep={prep}
          busy={busy}
          onRun={(force) => void onRun(force)}
          onPrepareClose={() => void onPrepareClose()}
          onPickEntity={(id) => void onPickEntity(id)}
          onMessage={onMessage}
          onError={onError}
        />
        <PostCallDebriefModal
          token={token}
          leadId={leadId}
          leadStatus={terminalStatus || 'chot'}
          open={debriefOpen}
          onClose={() => setDebriefOpen(false)}
          onSubmitted={() => {
            void load();
            onMessage?.('Đã gửi debrief — cảm ơn AM');
          }}
          onError={onError}
        />
      </>
    );
  }

  const debriefModal = (
    <PostCallDebriefModal
      token={token}
      leadId={leadId}
      leadStatus={terminalStatus || 'lost'}
      open={debriefOpen}
      onClose={() => setDebriefOpen(false)}
      onSubmitted={() => {
        void load();
        onMessage?.('Đã gửi debrief — cảm ơn AM');
      }}
      onError={onError}
    />
  );

  return (
    <>
      <section id="lmp-panel" className="lmp-panel">
      <header className="lmp-panel__head">
        <div>
          <h2 className="lmp-panel__title">Chuẩn bị cuộc hẹn</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            {prep?.status_label_vi ?? '—'}
            {prep?.close_readiness_score != null ? ` · Readiness ${prep.close_readiness_score}/100` : ''}
          </p>
        </div>
        {canRun ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onRun(true)}>
            Chạy lại
          </button>
        ) : null}
      </header>

      <LeadMeetingPrepProgress
        status={status}
        stepsCompleted={prep?.progress?.steps_completed}
        message={prep?.progress?.message_vi}
      />

      {status === 'awaiting_entity_choice' && prep?.entity_candidates?.length ? (
        <LeadMeetingPrepEntityPicker
          candidates={prep.entity_candidates}
          busy={busy}
          onSelect={onPickEntity}
        />
      ) : null}

      {status === 'skipped' ? (
        <div className="banner banner-info">
          <p>Prep bỏ qua — bổ sung thông tin công ty rồi chạy lại.</p>
          <label className="form-field" style={{ marginTop: '0.75rem' }}>
            Website (tuỳ chọn)
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
          </label>
          {canRun ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onRun(false)}>
              Chạy prep
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'failed' ? (
        <div className="banner banner-error">
          <strong>Lỗi prep</strong>
          <p>{prep?.error || 'Không rõ lỗi'}</p>
          {canRun ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onRun(true)}>
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}

      {status === 'ready' && result ? (
        <div className="lmp-panel__body">
          <section>
            <h3 className="lmp-panel__section-title">Chân dung doanh nghiệp</h3>
            <p>{result.company_profile.summary}</p>
            <ul className="lmp-facts">
              {(result.company_profile.facts ?? []).map((f, i) => (
                <li key={`${f.label}-${i}`}>
                  <strong>{f.label}:</strong> {f.value}{' '}
                  <span className={`lmp-badge lmp-badge--${f.type}`}>
                    {f.type === 'sourced' ? 'Có nguồn' : 'AI suy luận'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {result.website?.url ? (
            <p className="lmp-website-line">
              Website:{' '}
              <a href={result.website.url} target="_blank" rel="noreferrer">
                {result.website.url}
              </a>{' '}
              <span className="lmp-badge">{confidenceLabel(result.website.confidence)}</span>
            </p>
          ) : null}

          <section>
            <h3 className="lmp-panel__section-title">Đề xuất dịch vụ</h3>
            <ol className="lmp-dv-list">
              {result.recommended_services.map((svc) => (
                <li key={svc.dv_code}>
                  <strong>
                    {svc.priority}. {svc.dv_code} — {svc.name_vi}
                  </strong>
                  <span className="muted" style={{ display: 'block' }}>
                    {svc.reason}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="lmp-panel__section-title">Kịch bản mở đầu</h3>
            <p>{result.consulting_script.opening}</p>
            <h4>Câu hỏi gợi ý</h4>
            <ul>
              {result.consulting_script.key_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>

          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Thông tin từ nguồn công khai — AM xác nhận trước khi trích dẫn với khách.
          </p>
        </div>
      ) : null}

      {(status === 'pending' || status === 'running') && !result ? (
        <p className="muted">AI đang research — thường 1,5–4 phút. Trang tự cập nhật.</p>
      ) : null}

      {showDebriefPrompt ? (
        <div className="banner banner-info" style={{ marginTop: '1rem' }}>
          <p>Lead đã {terminalStatus === 'chot' ? 'chốt' : 'lost'} — vui lòng gửi debrief SCI.</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setDebriefOpen(true)}>
            Mở debrief
          </button>
        </div>
      ) : null}
      </section>
      {debriefModal}
    </>
  );
}
