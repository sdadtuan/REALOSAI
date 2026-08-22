'use client';

interface Props {
  open: boolean;
  busy?: boolean;
  initialScore?: number;
  onCancel: () => void;
  onConfirm: (score: number, reason: string) => void;
}

export function ScoreOverrideModal({ open, busy, initialScore, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="ai-dismiss-modal" role="presentation" onClick={onCancel}>
      <div
        className="ai-dismiss-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-score-override-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="ai-score-override-title">Điều chỉnh điểm lead</h4>
        <p className="muted">GDKD nhập điểm mới và lý do (≥10 ký tự) — AI-UC-006 / BR-AI-05.</p>
        <form
          className="ai-dismiss-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const scoreRaw = form.querySelector<HTMLInputElement>('input[name="override_score"]')?.value ?? '';
            const reason = form.querySelector<HTMLTextAreaElement>('textarea[name="override_reason"]')?.value ?? '';
            onConfirm(Number(scoreRaw), reason.trim());
          }}
        >
          <label className="ai-field">
            <span className="muted">Điểm mới (0–100)</span>
            <input
              type="number"
              name="override_score"
              min={0}
              max={100}
              step={1}
              defaultValue={initialScore ?? 50}
              required
              aria-label="Điểm override 0-100"
            />
          </label>
          <label className="ai-field">
            <span className="muted">Lý do điều chỉnh</span>
            <textarea
              name="override_reason"
              rows={3}
              minLength={10}
              required
              placeholder="Ví dụ: VIP khách — thiếu data activity nhưng ưu tiên cao"
              aria-label="Lý do điều chỉnh score"
            />
          </label>
          <div className="ai-dismiss-modal__actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu điều chỉnh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
