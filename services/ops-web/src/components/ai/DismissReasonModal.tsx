'use client';

import { DISMISS_REASON_PRESETS } from '@/lib/ai-api';

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function DismissReasonModal({ open, busy, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="ai-dismiss-modal" role="presentation" onClick={onCancel}>
      <div
        className="ai-dismiss-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dismiss-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="ai-dismiss-modal-title">Lý do bỏ gợi ý</h4>
        <p className="muted">Chọn lý do để cải thiện AI (RNOS-29 feedback loop).</p>
        <form
          className="ai-dismiss-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const selected = form.querySelector<HTMLInputElement>('input[name="dismiss_reason"]:checked');
            onConfirm(selected?.value ?? 'other');
          }}
        >
          <div className="ai-dismiss-modal__options">
            {DISMISS_REASON_PRESETS.map((preset) => (
              <label key={preset.value} className="ai-radio">
                <input type="radio" name="dismiss_reason" value={preset.value} defaultChecked={preset.value === 'not_needed'} />
                {preset.label}
              </label>
            ))}
          </div>
          <div className="ai-dismiss-modal__actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Xác nhận bỏ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
