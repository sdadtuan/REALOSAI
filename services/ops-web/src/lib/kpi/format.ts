/** RNOS-42 — KPI display helpers */

export function formatVnd(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

export function formatPct(value: unknown, digits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN');
}

export function periodLabel(year: number, month: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function formatOwnerMetric(value: unknown, fmt: unknown): string {
  const format = String(fmt ?? '');
  if (format === 'vnd') return formatVnd(value);
  if (format === 'pct') return formatPct(value);
  if (format === 'ratio') return `${formatNumber(value)}×`;
  if (format === 'days') return `${formatNumber(value)} ngày`;
  return formatNumber(value);
}

export function ownerMetricTargetLabel(value: unknown, fmt: unknown): string {
  if (value == null || value === '') return '—';
  return formatOwnerMetric(value, fmt);
}
