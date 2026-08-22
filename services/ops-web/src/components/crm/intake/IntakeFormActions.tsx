'use client';

import { IntakeAutosaveIndicator } from '@/components/crm/intake/IntakeAutosaveIndicator';
import type { IntakeAutosaveStatus } from '@/lib/crm/use-intake-autosave';

interface Props {
  isCompleted: boolean;
  saving: boolean;
  autosaveStatus: IntakeAutosaveStatus;
  autosaveSavedAt: Date | null;
  autosaveDirty?: boolean;
  onSave: () => void;
  onComplete: () => void;
  onReopen: () => void;
}

function ActionButtons({
  isCompleted,
  saving,
  onSave,
  onComplete,
  onReopen,
  compact,
}: Pick<Props, 'isCompleted' | 'saving' | 'onSave' | 'onComplete' | 'onReopen'> & {
  compact?: boolean;
}) {
  if (isCompleted) {
    return (
      <button
        type="button"
        className={`btn btn-secondary${compact ? ' btn-sm' : ' btn-sm'}`}
        disabled={saving}
        onClick={onReopen}
      >
        Mở lại phiên
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`btn${compact ? ' btn-sm' : ' btn-sm'}`}
        disabled={saving}
        onClick={onSave}
      >
        Lưu nháp
      </button>
      <button
        type="button"
        className={`btn${compact ? ' btn-sm' : ' btn-sm'}`}
        disabled={saving}
        onClick={onComplete}
      >
        Hoàn thành phiên
      </button>
    </>
  );
}

export function IntakeFormActions({
  isCompleted,
  saving,
  autosaveStatus,
  autosaveSavedAt,
  autosaveDirty,
  onSave,
  onComplete,
  onReopen,
}: Props) {
  return (
    <div className="intake-form-actions">
      <div className="intake-form-actions__inline">
        <ActionButtons
          isCompleted={isCompleted}
          saving={saving}
          onSave={onSave}
          onComplete={onComplete}
          onReopen={onReopen}
        />
        {!isCompleted ? (
          <IntakeAutosaveIndicator
            status={autosaveStatus}
            savedAt={autosaveSavedAt}
            dirty={autosaveDirty}
          />
        ) : null}
      </div>

      <div className="intake-form-actions__sticky" role="toolbar" aria-label="Thao tác phiên khảo sát">
        <ActionButtons
          isCompleted={isCompleted}
          saving={saving}
          onSave={onSave}
          onComplete={onComplete}
          onReopen={onReopen}
          compact
        />
      </div>
    </div>
  );
}
