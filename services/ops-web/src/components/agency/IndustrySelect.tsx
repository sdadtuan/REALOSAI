'use client';

import { useEffect, useState } from 'react';
import { fetchCatalogIndustries, type CatalogIndustryRow } from '@/lib/api';

const selectStyle = {
  padding: '0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  width: '100%',
} as const;

export interface IndustrySelectProps {
  token: string;
  value: string;
  onChange: (slug: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function IndustrySelect({
  token,
  value,
  onChange,
  required,
  disabled,
  placeholder = '— Chọn ngành —',
}: IndustrySelectProps) {
  const [industries, setIndustries] = useState<CatalogIndustryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchCatalogIndustries(token)
      .then((out) => {
        if (cancelled) return;
        setIndustries((out.industries ?? []).filter((row) => row.active !== false));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không tải danh mục ngành');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || loading || !!error}
        style={selectStyle}
      >
        <option value="">{loading ? 'Đang tải ngành…' : placeholder}</option>
        {industries.map((row) => (
          <option key={row.slug} value={row.slug}>
            {row.name}
          </option>
        ))}
      </select>
      {error ? <span className="error" style={{ fontSize: '0.85rem' }}>{error}</span> : null}
    </div>
  );
}

export function industryLabel(
  slug: string | null | undefined,
  industries: CatalogIndustryRow[],
): string {
  if (!slug) return '—';
  const hit = industries.find((row) => row.slug === slug);
  return hit ? `${hit.name} (${slug})` : slug;
}
