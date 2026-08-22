'use client';

import { useCallback, useState } from 'react';
import {
  patchAiRecommendation,
  postAiRecommendation,
  type AiRecommendationResponse,
  type FollowUpChannelHint,
} from '@/lib/ai-api';
import { ApiError } from '@/lib/api';
import { DismissReasonModal } from '@/components/ai/DismissReasonModal';

const CHANNELS: Array<{ value: FollowUpChannelHint; label: string }> = [
  { value: 'zalo', label: 'Zalo' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Ghi chú nội bộ' },
];

interface Props {
  token: string;
  leadId: number;
  onError?: (msg: string) => void;
  onActivityCreated?: () => void;
}

export function FollowUpDraftSection({ token, leadId, onError, onActivityCreated }: Props) {
  const [channel, setChannel] = useState<FollowUpChannelHint>('zalo');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearForm = useCallback(() => {
    setDraftId(null);
    setDraftText('');
    setSubject(null);
    setConfidence(null);
  }, []);

  const resetDraft = useCallback(() => {
    clearForm();
    setMessage(null);
    setError(null);
  }, [clearForm]);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const out = await postAiRecommendation(token, {
        type: 'follow_up_draft',
        entity_type: 'lead',
        entity_id: leadId,
        channel_hint: channel,
      });
      applyDraft(out);
    } catch (err) {
      const msg = formatAiError(err);
      setError(msg);
      onError?.(msg);
    } finally {
      setGenerating(false);
    }
  }

  function applyDraft(out: AiRecommendationResponse) {
    setDraftId(out.data.id);
    setDraftText(out.data.text);
    setSubject(out.data.subject ?? null);
    setConfidence(out.data.confidence);
  }

  async function onApprove() {
    if (!draftId || draftText.trim().length < 10) {
      const msg = 'Cần nháp ≥ 10 ký tự trước khi duyệt.';
      setError(msg);
      return;
    }
    setApproving(true);
    setError(null);
    try {
      await patchAiRecommendation(token, draftId, {
        status: 'accepted',
        final_text: draftText.trim(),
      });
      clearForm();
      setMessage('Đã duyệt — ghi activity note trên timeline. Copy nội dung để gửi thủ công.');
      onActivityCreated?.();
    } catch (err) {
      const msg = formatAiError(err);
      setError(msg);
      onError?.(msg);
    } finally {
      setApproving(false);
    }
  }

  async function onDismissConfirm(reason: string) {
    if (!draftId) return;
    setDismissing(true);
    setError(null);
    try {
      await patchAiRecommendation(token, draftId, {
        status: 'dismissed',
        dismiss_reason: reason,
      });
      clearForm();
      setShowDismissModal(false);
      setMessage('Đã bỏ nháp — feedback đã ghi nhận.');
    } catch (err) {
      const msg = formatAiError(err);
      setError(msg);
      onError?.(msg);
    } finally {
      setDismissing(false);
    }
  }

  function onDismissClick() {
    if (!draftId) return;
    setShowDismissModal(true);
  }

  async function onCopy() {
    if (!draftText.trim()) return;
    try {
      await navigator.clipboard.writeText(draftText.trim());
      setMessage('Đã copy vào clipboard.');
    } catch {
      setError('Không copy được — chọn và copy thủ công.');
    }
  }

  return (
    <section className="ai-copilot-section" aria-label="Soạn follow-up">
      <h4 className="ai-copilot-section__title">Soạn follow-up</h4>
      <p className="muted ai-followup-hint">
        Chọn kênh → Soạn nháp → chỉnh sửa → Duyệt (ghi activity) hoặc Copy. Không gửi tự động.
      </p>

      <div className="ai-followup-channels" role="radiogroup" aria-label="Kênh follow-up">
        {CHANNELS.map((c) => (
          <label key={c.value} className="ai-radio">
            <input
              type="radio"
              name="followup-channel"
              value={c.value}
              checked={channel === c.value}
              onChange={() => {
                setChannel(c.value);
                resetDraft();
              }}
            />
            {c.label}
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-sm"
        onClick={() => void onGenerate()}
        disabled={generating || approving || dismissing}
      >
        {generating ? 'Đang soạn…' : 'Soạn nháp'}
      </button>

      {generating ? <div className="ai-skeleton ai-skeleton--summary" aria-hidden="true" /> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ai-followup-message">{message}</p> : null}

      {draftText && !generating ? (
        <div className="ai-followup-draft">
          {channel === 'email' && subject ? (
            <p className="muted ai-followup-subject">
              Tiêu đề gợi ý: <strong>{subject}</strong>
            </p>
          ) : null}
          {confidence != null ? (
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              Confidence: {Math.round(confidence * 100)}%
            </p>
          ) : null}
          <label className="ai-field">
            <span className="muted">Nội dung nháp (chỉnh sửa trước khi duyệt)</span>
            <textarea
              rows={6}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              aria-label="Nội dung nháp follow-up"
            />
          </label>
          <div className="ai-followup-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void onApprove()}
              disabled={approving || dismissing}
            >
              {approving ? 'Đang duyệt…' : 'Duyệt'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onDismissClick}
              disabled={approving || dismissing}
            >
              {dismissing ? 'Đang bỏ…' : 'Bỏ'}
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onCopy()}>
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <DismissReasonModal
        open={showDismissModal}
        busy={dismissing}
        onCancel={() => setShowDismissModal(false)}
        onConfirm={(reason) => void onDismissConfirm(reason)}
      />
    </section>
  );
}

function formatAiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'Không có quyền xem lead này (BR-AI-04).';
    if (err.status === 409) return 'Nháp đã được xử lý — soạn lại nếu cần.';
    if (err.status === 429) return 'Quá nhiều yêu cầu — thử lại sau 1 phút.';
    if (err.status === 503) return 'AI tạm ngưng — thử lại sau.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Lỗi AI';
}
