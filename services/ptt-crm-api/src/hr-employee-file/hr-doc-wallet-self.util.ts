import type { HrDocCategory } from './hr-doc-wallet.types';
import { HR_SELF_SUBMIT_CATEGORIES } from './hr-doc-wallet.types';

export function canSelfSubmitCategory(category: string | undefined): boolean {
  return HR_SELF_SUBMIT_CATEGORIES.has(String(category ?? '') as HrDocCategory);
}

export function filterSelfVisibleCards<T extends { visibility: string; status: string }>(cards: T[]): T[] {
  return cards.filter(
    (c) => c.visibility === 'self' || c.status === 'pending_review' || c.status === 'valid',
  );
}
