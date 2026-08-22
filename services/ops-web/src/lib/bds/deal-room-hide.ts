import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';
import { hasAnyBdsCap } from './caps';

export function shouldHideDealRoom(input: {
  leadFlowKind?: string | null;
  user: StoredStaffUser | null;
}): boolean {
  if (String(input.leadFlowKind ?? '') === 're_buyer') return true;
  if (hasAnyBdsCap(input.user) && !hasCap(input.user, 'crm_b2b_projects', 'view')) {
    return true;
  }
  return false;
}
