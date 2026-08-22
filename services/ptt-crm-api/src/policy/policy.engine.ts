import {
  POLICY_BUNDLE_VERSION,
  PolicyContext,
  PolicyEvaluateResult,
  PolicyId,
} from './policy.types';

const MKT_JOB_FUNCTIONS = new Set(['content', 'design', 'technical']);
const MKT_SET_PATTERN = /mkt|solution|content|marketing/i;

function hasMktFunction(jobFunctions: string[] | undefined): boolean {
  return (jobFunctions ?? []).some((fn) => MKT_JOB_FUNCTIONS.has(String(fn).trim().toLowerCase()));
}

function hasMktPermissionSet(permissionSets: string[] | undefined): boolean {
  return (permissionSets ?? []).some((code) => MKT_SET_PATTERN.test(String(code).trim()));
}

function evaluateRelease(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_release_without_handoff';
  const allow =
    ctx.handoff_status === 'with_solution' &&
    ctx.has_handoff_activity === true &&
    ctx.consult_complete === true &&
    ctx.preliminary_plan_ok === true;
  return {
    allow,
    policy_id: policyId,
    reason: allow
      ? undefined
      : 'Solution release requires handoff activity, completed Consult tasks, and valid preliminary MKT plan.',
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

function evaluateClaim(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_claim_without_mkt_set';
  const allow =
    ctx.gdkd_assign === true ||
    hasMktFunction(ctx.job_functions) ||
    hasMktPermissionSet(ctx.permission_sets);
  return {
    allow,
    policy_id: policyId,
    reason: allow
      ? undefined
      : 'Solution claim requires MKT job function (content/design/technical) or MKT permission set.',
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

function evaluateBreakGlass(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'rbac.break_glass_not_expired';
  const deny = ctx.break_glass_active === true && ctx.break_glass_expired === true;
  return {
    allow: !deny,
    policy_id: policyId,
    reason: deny ? 'Break-glass grant expired (TTL 24h).' : undefined,
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

export function evaluatePolicy(policyId: PolicyId, ctx: PolicyContext): PolicyEvaluateResult {
  switch (policyId) {
    case 'presales.no_release_without_handoff':
      return evaluateRelease(ctx);
    case 'presales.no_claim_without_mkt_set':
      return evaluateClaim(ctx);
    case 'rbac.break_glass_not_expired':
      return evaluateBreakGlass(ctx);
    default:
      return {
        allow: false,
        policy_id: policyId,
        reason: 'unknown_policy',
        bundle_version: POLICY_BUNDLE_VERSION,
      };
  }
}

export function evaluateByAction(ctx: PolicyContext): PolicyEvaluateResult {
  if (ctx.action === 'release') {
    return evaluateRelease(ctx);
  }
  if (ctx.action === 'claim') {
    return evaluateClaim(ctx);
  }
  return evaluateBreakGlass(ctx);
}
