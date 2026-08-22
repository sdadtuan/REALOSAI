'use client';

import type { StaffPermissionSetSummary } from '@/lib/api';

type Props = {
  options: StaffPermissionSetSummary[];
  value: string[];
  disabled?: boolean;
  onChange: (codes: string[]) => void;
};

export function PermissionSetPicker({ options, value, disabled, onChange }: Props) {
  function toggle(code: string) {
    if (disabled) return;
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code].sort());
  }

  return (
    <section>
      <p className="muted" style={{ margin: '0 0 0.35rem' }}>
        Permission Sets (bổ sung)
      </p>
      {options.length === 0 ? (
        <p className="muted">Chưa có set — tạo tại /admin/crm/permission-sets</p>
      ) : (
        <div className="win-filter-chips">
          {options.map((set) => (
            <button
              key={set.code}
              type="button"
              className={`chip${value.includes(set.code) ? ' is-active' : ''}`}
              disabled={disabled}
              title={`${set.name} · ${set.grant_count} grants`}
              onClick={() => toggle(set.code)}
            >
              {set.code}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
