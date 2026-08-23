import type { BdsUnit } from './types';

export function isUnitHoldable(status: string | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'available' || s === '';
}

export function filterHoldableUnits(units: BdsUnit[]): BdsUnit[] {
  return units.filter((u) => isUnitHoldable(u.status));
}

export function formatHoldTtlRemaining(expiresAt: string | null | undefined, now = new Date()): string {
  if (!expiresAt) return '—';
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return '—';
  const sec = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  if (sec <= 0) return 'Hết hạn';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}p`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function holdCreateSuccessMessage(unitCode: string, expiresAt: string | null | undefined): string {
  const ttl = formatHoldTtlRemaining(expiresAt);
  return `Đã giữ ${unitCode}${ttl !== '—' ? ` · hết hạn ${ttl}` : ''}`;
}

export function unitStatusLabel(status: string | undefined): string {
  const map: Record<string, string> = {
    available: 'Trống',
    hold: 'Giữ',
    reserved: 'Giữ chỗ',
    booked: 'Đã cọc',
    sold: 'HĐMB',
    locked: 'Khóa',
  };
  const key = String(status ?? '').trim().toLowerCase();
  return map[key] ?? (key || '—');
}

export function openHoldStatuses(): Set<string> {
  return new Set(['pending', 'active']);
}
