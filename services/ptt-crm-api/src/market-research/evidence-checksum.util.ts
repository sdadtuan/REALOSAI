import { createHash } from 'crypto';

export function evidenceChecksum(parts: {
  locator?: string | null;
  excerpt?: string | null;
  value_num?: number | string | null;
  unit?: string | null;
  period_note?: string | null;
  geography?: string | null;
}): string {
  const raw = [
    parts.locator ?? '',
    parts.excerpt ?? '',
    parts.value_num == null || parts.value_num === '' ? '' : String(parts.value_num),
    parts.unit ?? '',
    parts.period_note ?? '',
    parts.geography ?? '',
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}
