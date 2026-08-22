import { hasCap, type StoredStaffUser } from '@/lib/auth';

export interface PresalesSolutionCaps {
  canView: boolean;
  canEditConsult: boolean;
  canClaim: boolean;
  canRelease: boolean;
  canHandoff: boolean;
  isGdkd: boolean;
}

export function resolvePresalesSolutionCaps(user: StoredStaffUser | null): PresalesSolutionCaps {
  const isGdkd = Boolean(user && hasCap(user, 'crm_leads', 'assign'));
  return {
    canView: Boolean(user && (hasCap(user, 'crm_presales_solution', 'view') || hasCap(user, 'crm_leads', 'view'))),
    canEditConsult: Boolean(
      user &&
        (hasCap(user, 'crm_presales_solution', 'edit') || isGdkd),
    ),
    canClaim: Boolean(user && (hasCap(user, 'crm_presales_solution', 'claim') || isGdkd)),
    canRelease: Boolean(user && (hasCap(user, 'crm_presales_solution', 'release') || isGdkd)),
    canHandoff: Boolean(user && hasCap(user, 'crm_leads', 'edit')),
    isGdkd,
  };
}

export function isConsultWorkspaceReadOnly(
  funnel: { presales?: { handoff?: { status?: string } } | null } | null,
  caps: PresalesSolutionCaps,
): boolean {
  const status = String(funnel?.presales?.handoff?.status ?? '');
  if (status !== 'pending' && status !== 'with_solution') return false;
  return !caps.canEditConsult;
}
