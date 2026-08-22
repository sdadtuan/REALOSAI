export const POLICY_BUNDLE_VERSION = '2026-08-07-win4c-v1';

export type PolicyId =
  | 'presales.no_release_without_handoff'
  | 'presales.no_claim_without_mkt_set'
  | 'rbac.break_glass_not_expired';

export type PresalesPolicyAction = 'release' | 'claim' | 'break_glass_union';

export interface PolicyEvaluateInput {
  policy_id: PolicyId;
  context: PolicyContext;
}

export interface PolicyContext {
  action: PresalesPolicyAction;
  handoff_status?: string | null;
  has_handoff_activity?: boolean;
  consult_complete?: boolean;
  preliminary_plan_ok?: boolean;
  job_functions?: string[];
  permission_sets?: string[];
  gdkd_assign?: boolean;
  break_glass_active?: boolean;
  break_glass_expired?: boolean;
}

export interface PolicyEvaluateResult {
  allow: boolean;
  policy_id: PolicyId;
  reason?: string;
  bundle_version: string;
}

export interface PresalesPolicyPreview {
  action: 'release' | 'claim';
  allowed: boolean;
  policy_id?: PolicyId;
  reason?: string;
  bundle_version: string;
}
