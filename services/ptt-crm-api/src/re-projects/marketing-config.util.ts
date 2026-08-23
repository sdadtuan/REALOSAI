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

export function assertCanEnableLeadForms(input: {
  metaAdAccountId: unknown;
  webhookEnabled?: boolean;
  forms?: unknown[];
}): void {
  const mapped = isMetaAdAccountMapped(input.metaAdAccountId);
  const wantsForms =
    input.webhookEnabled === true ||
    (Array.isArray(input.forms) && input.forms.length > 0);
  if (wantsForms && !mapped) {
    throw new Error('Cần gắn Meta ad account (act_*) trước khi bật form lead.');
  }
}
