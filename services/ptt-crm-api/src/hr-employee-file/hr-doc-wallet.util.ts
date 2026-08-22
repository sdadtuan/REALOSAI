import type { HrDocCardStatus, HrDocTypeRow, HrDocWalletCardRow } from './hr-doc-wallet.types';

const MS_DAY = 86_400_000;

export function computeDocCardStatus(
  expiresOn: string | null | undefined,
  current: HrDocCardStatus = 'valid',
): HrDocCardStatus {
  if (current === 'revoked' || current === 'replaced' || current === 'pending_review') {
    return current;
  }
  const raw = String(expiresOn ?? '').slice(0, 10);
  if (!raw) return 'valid';
  const exp = new Date(`${raw}T00:00:00Z`).getTime();
  const now = Date.now();
  if (exp < now) return 'expired';
  if (exp - now <= 30 * MS_DAY) return 'expiring';
  return 'valid';
}

export function isEducationCategory(category: string | undefined): boolean {
  return category === 'education' || category === 'cert';
}

export function computeWalletCompleteness(
  requiredTypes: HrDocTypeRow[],
  cards: Array<Pick<HrDocWalletCardRow, 'type_code' | 'status' | 'file_count'>>,
): number {
  const required = requiredTypes.filter((t) => t.is_required_onboard);
  if (!required.length) return 100;
  let ok = 0;
  for (const type of required) {
    const has = cards.some(
      (c) =>
        c.type_code === type.type_code &&
        c.file_count > 0 &&
        !['revoked', 'replaced', 'expired', 'pending_review'].includes(String(c.status)),
    );
    if (has) ok += 1;
  }
  return Math.round((ok / required.length) * 100);
}

export function countExpiringCards(cards: Array<{ status: string }>): number {
  return cards.filter((c) => c.status === 'expiring' || c.status === 'expired').length;
}
