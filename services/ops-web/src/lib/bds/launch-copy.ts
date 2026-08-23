import type { BdsPriceList } from './types';

export type LaunchChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  warn?: boolean;
  detail: string;
};

export function formatLaunchTtlSec(sec: number | null | undefined): string {
  if (sec == null) return '—';
  if (sec <= 0) return 'Hết hạn';
  return `${sec}s`;
}

export function ttlRemainingFromExpires(
  expiresAt: string | null | undefined,
  now = new Date(),
): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export function launchTtlBarPercent(remainingSec: number | null, totalSec: number): number {
  if (remainingSec == null || totalSec <= 0) return 0;
  return Math.max(0, Math.min(100, (remainingSec / totalSec) * 100));
}

export type LaunchTtlUrgency = 'ok' | 'warn' | 'critical' | 'expired';

export function launchTtlUrgency(
  remainingSec: number | null,
  totalSec: number,
): LaunchTtlUrgency {
  if (remainingSec == null) return 'ok';
  if (remainingSec <= 0) return 'expired';
  if (remainingSec <= 30) return 'critical';
  if (totalSec > 0 && remainingSec <= totalSec * 0.25) return 'warn';
  return 'ok';
}

export function buildLaunchOpenChecklist(input: {
  g0Ready: boolean;
  missingG0: string[];
  priceListId: number | null;
  phaseId: string | null;
  holdTtlSeconds: number;
}): LaunchChecklistItem[] {
  const hasPrice = input.priceListId != null || Boolean(input.phaseId?.trim());
  return [
    {
      id: 'g0',
      label: 'G0 — Roster',
      ok: input.g0Ready,
      detail: input.g0Ready
        ? 'Đủ 5 vị trí A'
        : `Thiếu: ${input.missingG0.join(', ') || '…'}`,
    },
    {
      id: 'price',
      label: 'Khóa bảng giá',
      ok: hasPrice,
      warn: !hasPrice,
      detail: input.priceListId != null
        ? `Bảng giá #${input.priceListId} (snapshot khi mở)`
        : input.phaseId
          ? 'Lấy giá từ phase khi mở'
          : 'Chưa gán bảng giá / phase',
    },
    {
      id: 'ttl',
      label: 'TTL giữ ngắn',
      ok: input.holdTtlSeconds > 0,
      detail: `${input.holdTtlSeconds}s · hold mới hết hạn nhanh (ra quân)`,
    },
  ];
}

export function canOpenFromChecklist(items: LaunchChecklistItem[]): boolean {
  const g0 = items.find((i) => i.id === 'g0');
  const ttl = items.find((i) => i.id === 'ttl');
  return Boolean(g0?.ok && ttl?.ok);
}

export function priceLockBannerLabel(
  priceListId: number | null,
  priceLists: BdsPriceList[],
  locked: boolean,
): string {
  if (priceListId == null) {
    return locked ? 'Giá: chưa snapshot' : 'Giá: chưa khóa';
  }
  const pl = priceLists.find((p) => p.id === priceListId);
  const name = pl?.version_code || pl?.name;
  const suffix = name ? ` · ${name}` : '';
  return locked
    ? `Đã khóa bảng giá #${priceListId}${suffix}`
    : `Sẽ khóa bảng giá #${priceListId}${suffix}`;
}

export function unitLabel(productId: number, unitCodes: Record<number, string>): string {
  return unitCodes[productId]?.trim() || `Căn #${productId}`;
}

export function launchStatusBadge(status: string): string {
  const map: Record<string, string> = {
    draft: 'Nháp',
    open: 'Đang mở',
    closed: 'Đã đóng',
  };
  return map[status] ?? status;
}
