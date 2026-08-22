'use client';

import {
  formatIntakeAutosaveTime,
  type IntakeAutosaveStatus,
} from '@/lib/crm/use-intake-autosave';

interface Props {
  status: IntakeAutosaveStatus;
  savedAt: Date | null;
  dirty?: boolean;
}

export function IntakeAutosaveIndicator({ status, savedAt, dirty }: Props) {
  let text = '';
  let className = 'intake-autosave-indicator';

  if (status === 'saving') {
    text = 'Đang lưu…';
    className += ' intake-autosave-indicator--saving';
  } else if (status === 'error') {
    text = 'Lỗi lưu — thử lại';
    className += ' intake-autosave-indicator--error';
  } else if (status === 'saved' && savedAt) {
    text = `Đã lưu tự động ${formatIntakeAutosaveTime(savedAt)}`;
    className += ' intake-autosave-indicator--saved';
  } else if (dirty && status === 'pending') {
    text = 'Thay đổi chưa lưu — tự lưu sau 30s';
    className += ' intake-autosave-indicator--pending';
  }

  if (!text) return null;

  return <p className={className}>{text}</p>;
}
