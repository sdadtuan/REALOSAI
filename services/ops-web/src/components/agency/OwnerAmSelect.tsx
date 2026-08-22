'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchStaffRoster, type StaffRosterRow } from '@/lib/api';

const selectStyle = {
  padding: '0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  width: '100%',
} as const;

export interface OwnerAmSelectProps {
  token: string;
  value: string;
  onChange: (ownerAmId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function OwnerAmSelect({
  token,
  value,
  onChange,
  disabled,
  placeholder = '— Chọn AM —',
}: OwnerAmSelectProps) {
  const [staff, setStaff] = useState<StaffRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchStaffRoster(token)
      .then((out) => {
        if (cancelled) return;
        setStaff(out.staff ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không tải danh sách nhân viên');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const options = useMemo(() => {
    const rows = [...staff];
    const trimmed = value.trim();
    if (trimmed && !rows.some((row) => row.email === trimmed || row.id === trimmed)) {
      rows.unshift({
        id: trimmed,
        email: trimmed.includes('@') ? trimmed : '',
        display_name: trimmed,
        position_id: 0,
      });
    }
    return rows;
  }, [staff, value]);

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || !!error}
        style={selectStyle}
      >
        <option value="">{loading ? 'Đang tải nhân viên…' : placeholder}</option>
        {options.map((row) => (
          <option key={row.id} value={row.email || row.id}>
            {row.display_name || row.email}
            {row.email && row.display_name !== row.email ? ` · ${row.email}` : ''}
          </option>
        ))}
      </select>
      {error ? <span className="error" style={{ fontSize: '0.85rem' }}>{error}</span> : null}
    </div>
  );
}

export function ownerAmLabel(
  ownerAmId: string | null | undefined,
  staff: StaffRosterRow[],
): string {
  const raw = ownerAmId?.trim();
  if (!raw) return '—';
  const hit = staff.find((row) => row.email === raw || row.id === raw);
  if (!hit) return raw;
  if (hit.display_name && hit.display_name !== hit.email) {
    return `${hit.display_name} (${hit.email})`;
  }
  return hit.email || hit.display_name || raw;
}
