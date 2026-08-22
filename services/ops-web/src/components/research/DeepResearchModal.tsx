'use client';

type DeepResearchModalProps = {
  open: boolean;
  provider: string;
  questionLabel: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeepResearchModal({
  open,
  provider,
  questionLabel,
  saving,
  onClose,
  onConfirm,
}: DeepResearchModalProps) {
  if (!open) return null;
  const providerLabel =
    provider === 'gemini' ? 'Gemini Deep Research (env, Tavily fallback)' : 'OpenAI Deep Research (env, Tavily fallback)';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deep-research-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(15, 23, 15, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="page-card"
        style={{ maxWidth: 480, width: '100%', padding: '1.1rem 1.2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="deep-research-title" style={{ margin: '0 0 0.65rem', fontSize: '1.1rem' }}>
          Chạy Deep Research
        </h2>
        <p className="muted" style={{ margin: '0 0 0.35rem' }}>
          Provider: {providerLabel}
        </p>
        <p style={{ margin: '0 0 0.75rem' }}>Câu hỏi: {questionLabel}</p>
        <p
          role="note"
          style={{
            margin: '0 0 0.85rem',
            padding: '0.55rem 0.75rem',
            borderRadius: 8,
            border: '1px solid rgba(234, 179, 8, 0.45)',
            background: 'rgba(234, 179, 8, 0.12)',
          }}
        >
          Kết quả chỉ là nguồn nháp + dàn ý. Không phải số liệu đã audit. Insight sẽ không được tạo tự
          động.
        </p>
        <p className="muted" style={{ margin: '0 0 0.85rem', fontSize: '0.85rem' }}>
          Timeout tối đa 15 phút.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onConfirm} disabled={saving}>
            {saving ? 'Đang chạy…' : 'Chạy'}
          </button>
        </div>
      </div>
    </div>
  );
}
