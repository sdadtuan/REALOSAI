import type { ReactNode } from 'react';

type BulkActionBarProps = {
  count: number;
  label?: string;
  children: ReactNode;
};

export function BulkActionBar({ count, label = 'đã chọn', children }: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <div className="bulk-action-bar" role="status">
      <span className="bulk-action-bar__count">
        <strong>{count}</strong> {label}
      </span>
      <div className="bulk-action-bar__actions">{children}</div>
    </div>
  );
}
