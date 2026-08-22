'use client';

import { useState } from 'react';
import type { AiExplainability, AiScoreRecord } from '@/lib/ai-api';
import { postAiScoreOverride } from '@/lib/ai-api';
import { ApiError } from '@/lib/api';
import { ScoreOverrideModal } from '@/components/ai/ScoreOverrideModal';

const BAND_LABELS: Record<string, string> = {
  hot: 'NÓNG',
  warm: 'ẤM',
  cold: 'LẠNH',
};

interface Props {
  score: AiScoreRecord | null;
  pending?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
  canOverride?: boolean;
  leadId?: number;
  token?: string;
  onScoreUpdated?: (score: AiScoreRecord) => void;
  onError?: (msg: string) => void;
}

export function ScoreCard({
  score,
  pending,
  error,
  onRefresh,
  refreshing,
  title = 'Điểm lead',
  canOverride = false,
  leadId,
  token,
  onScoreUpdated,
  onError,
}: Props) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);

  async function onOverrideConfirm(nextScore: number, reason: string) {
    if (!token || !leadId) return;
    if (reason.length < 10) {
      const msg = 'Lý do cần ≥ 10 ký tự.';
      onError?.(msg);
      return;
    }
    if (!Number.isFinite(nextScore) || nextScore < 0 || nextScore > 100) {
      const msg = 'Điểm phải từ 0 đến 100.';
      onError?.(msg);
      return;
    }
    setOverriding(true);
    setOverrideMessage(null);
    try {
      const out = await postAiScoreOverride(token, {
        lead_id: leadId,
        score: Math.round(nextScore),
        override_reason: reason,
      });
      setShowOverrideModal(false);
      setOverrideMessage('Đã lưu điều chỉnh GDKD.');
      onScoreUpdated?.({
        id: out.data.score_id,
        score_value: out.data.score,
        confidence: out.data.confidence,
        explainability_json: out.data.explainability,
        model_name: out.data.model_name,
        calculated_at: out.data.calculated_at,
        overridden_by: 'gdkd',
        override_reason: reason,
      });
    } catch (err) {
      const msg = formatOverrideError(err);
      onError?.(msg);
    } finally {
      setOverriding(false);
    }
  }

  if (pending) {
    return (
      <section className="ai-score-card" aria-busy="true" aria-label="Điểm lead đang cập nhật">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
        </div>
        <div className="ai-skeleton ai-skeleton--score" />
        <p className="muted ai-score-card__pending">Score đang cập nhật…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ai-score-card" aria-label="Điểm lead">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
          {onRefresh ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '…' : '↻'}
            </button>
          ) : null}
        </div>
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!score) {
    return (
      <section className="ai-score-card" aria-label="Điểm lead">
        <div className="ai-score-card__header">
          <h4 className="ai-score-card__title">{title}</h4>
          {onRefresh ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? '…' : '↻'}
            </button>
          ) : null}
        </div>
        <p className="muted">Chưa có điểm — tạo lead mới sẽ được chấm trong ~30 giây.</p>
      </section>
    );
  }

  const explain: AiExplainability = score.explainability_json ?? {
    factors: [],
    flags: [],
    score_band: 'warm',
  };
  const band = explain.score_band ?? 'warm';
  const confidence = score.confidence ?? 0;
  const isOverride = Boolean(score.overridden_by || score.model_name === 'manual_override');

  return (
    <section className="ai-score-card" aria-label="Điểm lead">
      <div className="ai-score-card__header">
        <h4 className="ai-score-card__title">{title}</h4>
        <div className="ai-score-card__header-actions">
          {canOverride ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowOverrideModal(true)}
              disabled={overriding}
            >
              Điều chỉnh score
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onRefresh}
              disabled={refreshing || overriding}
              aria-label="Làm mới điểm"
            >
              {refreshing ? '…' : '↻'}
            </button>
          ) : null}
        </div>
      </div>
      {isOverride ? (
        <p className="ai-score-override-badge" aria-label="Score đã được GDKD điều chỉnh">
          GDKD điều chỉnh
        </p>
      ) : null}
      <div className="ai-score-gauge">
        <span className="ai-score-gauge__value">{Math.round(score.score_value)}</span>
        <span className={`ai-score-gauge__band ai-score-gauge__band--${band}`}>
          {BAND_LABELS[band] ?? band.toUpperCase()}
        </span>
      </div>
      <p className="muted ai-score-card__confidence">
        Độ tin cậy: {Math.round(confidence * 100)}%
      </p>
      {overrideMessage ? <p className="ai-followup-message">{overrideMessage}</p> : null}
      <ExplainabilityChips explain={explain} />
      <ScoreOverrideModal
        open={showOverrideModal}
        busy={overriding}
        initialScore={Math.round(score.score_value)}
        onCancel={() => setShowOverrideModal(false)}
        onConfirm={(nextScore, reason) => void onOverrideConfirm(nextScore, reason)}
      />
    </section>
  );
}

function ExplainabilityChips({ explain }: { explain: AiExplainability }) {
  const factors = explain.factors ?? [];
  if (!factors.length && !(explain.flags?.length)) {
    return <p className="muted">Chưa có yếu tố giải thích.</p>;
  }
  return (
    <ul className="ai-explain-chips" aria-label="Yếu tố giải thích">
      {factors.map((f) => (
        <li
          key={f.key}
          className={`ai-explain-chip ai-explain-chip--${f.sign === '+' ? 'pos' : 'neg'}`}
        >
          <span className="ai-explain-chip__sign">{f.sign}</span>
          {f.label}
        </li>
      ))}
      {(explain.flags ?? []).map((flag) => (
        <li key={flag} className="ai-explain-chip ai-explain-chip--flag">
          {flag}
        </li>
      ))}
    </ul>
  );
}

function formatOverrideError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'Không có quyền điều chỉnh score (cần GDKD).';
    if (err.status === 400) return err.message;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Lưu điều chỉnh thất bại';
}
