'use client';

import {
  formatIntakeAutosaveTime,
  type IntakeAutosaveStatus,
} from '@/lib/crm/use-intake-autosave';

interface Props {
  status: IntakeAutosaveStatus;
  savedAt: Date | null;
  dirty: boolean;
  entityLabel?: string;
}

export function DraftAutosaveHint({
  status,
  savedAt,
  dirty,
  entityLabel = 'draft',
}: Props) {
  let hint: string | null = null;
  if (status === 'pending') hint = 'Đang chờ lưu…';
  else if (status === 'saving') hint = `Đang lưu ${entityLabel}…`;
  else if (status === 'saved' && savedAt)
    hint = `Đã lưu ${formatIntakeAutosaveTime(savedAt)}`;
  else if (status === 'error') hint = 'Lưu tự động thất bại — chỉnh lại hoặc thử blur field';

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {hint ? (
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {hint}
        </span>
      ) : null}
      {dirty ? (
        <span
          style={{
            fontSize: '0.8rem',
            padding: '0.15rem 0.45rem',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'rgba(255, 180, 0, 0.08)',
          }}
        >
          Đã chỉnh sửa thủ công
        </span>
      ) : null}
    </div>
  );
}
