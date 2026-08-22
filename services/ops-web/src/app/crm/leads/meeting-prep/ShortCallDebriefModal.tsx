'use client';

import { useState } from 'react';
import { submitLeadMeetingPrepCallDebrief } from '@/lib/lead-meeting-prep-api';

type Props = {
  token: string;
  leadId: number;
  activityId?: number | null;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  onError?: (msg: string) => void;
};

export function ShortCallDebriefModal({
  token,
  leadId,
  activityId,
  open,
  onClose,
  onSubmitted,
  onError,
}: Props) {
  const [objection, setObjection] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sciHelpful, setSciHelpful] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasObjection = Boolean(objection.trim());
    const hasFeedback = Boolean(feedback.trim());
    const hasSciHelpful = sciHelpful !== null;
    if (!hasObjection && !hasFeedback && !hasSciHelpful) {
      onError?.('Trả lời ít nhất một câu hoặc bấm Bỏ qua');
      return;
    }

    setBusy(true);
    try {
      await submitLeadMeetingPrepCallDebrief(token, leadId, {
        activity_id: activityId ?? undefined,
        objection_faced: objection.trim() || undefined,
        am_feedback: feedback.trim() || undefined,
        sci_helpful: sciHelpful === null ? undefined : sciHelpful,
      });
      setObjection('');
      setFeedback('');
      setSciHelpful(null);
      onSubmitted?.();
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gửi debrief thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="lmp-debrief-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lmp-call-debrief-title"
    >
      <div className="lmp-debrief-modal lmp-debrief-modal--short">
        <header className="lmp-debrief-modal__head">
          <h2 id="lmp-call-debrief-title">Debrief nhanh sau cuộc gọi</h2>
          <p className="muted">3 câu ngắn — giúp SCI học objection thực tế</p>
        </header>
        <form onSubmit={(e) => void onSubmit(e)} className="lmp-debrief-form">
          <label className="form-field">
            Objection / phản hồi khách
            <textarea
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              rows={2}
              placeholder="VD: Đắt quá, cần hỏi sếp…"
            />
          </label>

          <label className="form-field">
            Ghi chú AM (tuỳ chọn)
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="Script nào hữu ích? Cần cải thiện gì?"
            />
          </label>

          <div className="lmp-debrief-helpful">
            <span className="muted">SCI hữu ích?</span>
            <button
              type="button"
              className={`btn btn-sm ${sciHelpful === true ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSciHelpful(true)}
            >
              👍 Có
            </button>
            <button
              type="button"
              className={`btn btn-sm ${sciHelpful === false ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSciHelpful(false)}
            >
              👎 Không
            </button>
          </div>

          <footer className="lmp-debrief-modal__actions">
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onClose}>
              Bỏ qua
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi debrief'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
