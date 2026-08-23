export function normalizeMetaAdAccountId(raw: unknown): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('act_')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `act_${digits}` : trimmed;
}

export function isMetaAdAccountMapped(raw: unknown): boolean {
  return normalizeMetaAdAccountId(raw).length > 0;
}

export function mktLeadFormHint(mapped: boolean): string {
  return mapped
    ? 'Có thể bật form lead và webhook sau khi lưu page/form.'
    : 'Gắn Meta ad account (act_*) trước khi bật form — MK-02.';
}
