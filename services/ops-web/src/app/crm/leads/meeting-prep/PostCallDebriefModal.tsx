'use client';

import { useState } from 'react';
import { submitLeadMeetingPrepDebrief } from '@/lib/lead-meeting-prep-api';

type Props = {
  token: string;
  leadId: number;
  leadStatus: string;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  onError?: (msg: string) => void;
};

const TIERS = [
  { value: 'CB', label: 'CB — Cơ bản' },
  { value: 'TC', label: 'TC — Tiêu chuẩn (recommended)' },
  { value: 'CS', label: 'CS — Cao cấp' },
] as const;

export function PostCallDebriefModal({
  token,
  leadId,
  leadStatus,
  open,
  onClose,
  onSubmitted,
  onError,
}: Props) {
  const [closedTier, setClosedTier] = useState<'CB' | 'TC' | 'CS' | ''>('');
  const [objection, setObjection] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sciHelpful, setSciHelpful] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const terminal = leadStatus.toLowerCase();
  const isWon = terminal === 'chot';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitLeadMeetingPrepDebrief(token, leadId, {
        closed_tier: closedTier || undefined,
        objection_faced: objection.trim() || undefined,
        am_feedback: feedback.trim() || undefined,
        sci_helpful: sciHelpful === null ? undefined : sciHelpful,
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gửi debrief thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lmp-debrief-overlay" role="dialog" aria-modal="true" aria-labelledby="lmp-debrief-title">
      <div className="lmp-debrief-modal">
        <header className="lmp-debrief-modal__head">
          <h2 id="lmp-debrief-title">Debrief sau {isWon ? 'chốt' : 'lost'}</h2>
          <p className="muted">3 câu ngắn — feed SCI win loop (M4)</p>
        </header>
        <form onSubmit={(e) => void onSubmit(e)} className="lmp-debrief-form">
          {isWon ? (
            <label className="form-field">
              Gói đã chốt (CB/TC/CS)
              <select
                value={closedTier}
                onChange={(e) => setClosedTier(e.target.value as 'CB' | 'TC' | 'CS' | '')}
                aria-label="Gói chốt"
              >
                <option value="">— Chọn gói —</option>
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="form-field">
            Objection thực tế khách nêu
            <textarea
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              rows={2}
              placeholder="VD: Đắt quá, cần suy nghĩ thêm…"
            />
          </label>

          <label className="form-field">
            SCI có hữu ích? / Ghi chú AM
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Talk track / offer ladder giúp gì? Cần cải thiện gì?"
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
