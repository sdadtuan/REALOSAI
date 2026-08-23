export function financeHubDisclaimer(): string {
  return 'Số điều hành BĐS — không phải hạch toán ERP.';
}

export function collectionsPageDisclaimer(): string {
  return 'Sổ thu căn — không phải hạch toán.';
}

export function agingBucketLabel(bucket: string): string {
  const map: Record<string, string> = {
    '0_15': '0–15 ngày',
    '16_30': '16–30 ngày',
    '31_60': '31–60 ngày',
    '60_plus': '>60 ngày',
  };
  return map[bucket] ?? bucket;
}

export function buildMilestoneStatusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    planned: 'Kế hoạch',
    reached: 'Đạt mốc',
    delayed: 'Trễ',
  };
  const key = String(status ?? '').trim().toLowerCase();
  return map[key] ?? (key || '—');
}

export function buildMilestoneDisplay(
  code: string | null | undefined,
  name: string | null | undefined,
): string {
  const c = String(code ?? '').trim();
  const n = String(name ?? '').trim();
  if (n && c) return `${n} (${c})`;
  return n || c || '—';
}

export type AgingBucketSummary = { bucket: string; count: number; remainingVnd: number };

export function summarizeAgingBuckets(
  rows: Array<{ bucket: string; amount_vnd: number; paid_vnd: number }>,
): AgingBucketSummary[] {
  const order = ['0_15', '16_30', '31_60', '60_plus'];
  const map = new Map<string, AgingBucketSummary>();
  for (const row of rows) {
    const prev = map.get(row.bucket) ?? { bucket: row.bucket, count: 0, remainingVnd: 0 };
    prev.count += 1;
    prev.remainingVnd += Math.max(0, row.amount_vnd - row.paid_vnd);
    map.set(row.bucket, prev);
  }
  return order.filter((b) => map.has(b)).map((b) => map.get(b)!);
}

export function adsRoasCopy(mapped: boolean): string {
  return mapped ? 'ROAS căn cần spend Meta đã map.' : 'Chưa gắn ad account';
}
