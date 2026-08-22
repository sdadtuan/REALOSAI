'use client';

import { useEffect, useState } from 'react';
import { WinDiffChip } from '@/components/win';
import { getQualityTier } from '@/lib/mkt-ai-quality-labels';
import { truncatePreview, type TmmtFieldDiff } from '@/lib/mkt-ai-apply-diff';

interface Props {
  open: boolean;
  busy?: boolean;
  score: number;
  diffs: TmmtFieldDiff[];
  onClose: () => void;
  onConfirm: () => void;
}

export function AiApplyTmmtModal({ open, busy = false, score, diffs, onClose, onConfirm }: Props) {
  const [reviewed, setReviewed] = useState(false);
  const [showFullDiff, setShowFullDiff] = useState(false);

  useEffect(() => {
    if (open) {
      setReviewed(false);
      setShowFullDiff(false);
    }
  }, [open]);

  if (!open) return null;

  const tier = getQualityTier(score);
  const changedCount = diffs.filter((d) => d.changed).length;
  const fieldsToWrite = diffs.filter((d) => d.draft.trim()).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mkt-ai-apply-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'min(85vh, 720px)',
          overflow: 'auto',
          padding: '1.25rem',
          display: 'grid',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h3 id="mkt-ai-apply-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Apply vào TMMT chính thức
          </h3>
          <WinDiffChip added={changedCount} removed={0} />
        </div>

        {tier === 'conditional' ? (
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              padding: '0.55rem 0.75rem',
              borderRadius: 8,
              border: '1px solid #c9920a',
              background: 'rgba(255, 180, 0, 0.08)',
            }}
          >
            Quality {score}/100 (60–69): nên review kỹ từng mục TMMT trước khi ghi đè bản chính thức.
          </p>
        ) : null}

        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Bạn sắp ghi đè <strong>{fieldsToWrite}</strong> trường TMMT bằng bản draft AI
          {changedCount > 0 ? ` (${changedCount} thay đổi so với official hiện tại)` : ''}.
        </p>

        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
          {diffs
            .filter((d) => d.draft.trim())
            .slice(0, showFullDiff ? undefined : 5)
            .map((d) => (
              <li key={`${d.section}-${d.key}`}>
                <strong>{d.label}</strong>
                {d.changed ? ' · thay đổi' : d.official ? ' · giữ nguyên' : ' · mới'}
                <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Draft: {truncatePreview(d.draft, 100)}
                </div>
              </li>
            ))}
        </ul>

        {diffs.filter((d) => d.draft.trim()).length > 5 ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setShowFullDiff((v) => !v)}
          >
            {showFullDiff ? 'Thu gọn diff' : 'Xem diff đầy đủ ▼'}
          </button>
        ) : null}

        <label
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
            fontSize: '0.9rem',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={reviewed}
            disabled={busy}
            onChange={(e) => setReviewed(e.target.checked)}
            style={{ marginTop: '0.2rem' }}
          />
          <span>Tôi đã review và chỉnh sửa nội dung AI</span>
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || !reviewed}
            onClick={onConfirm}
          >
            {busy ? 'Đang apply…' : 'Xác nhận Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
