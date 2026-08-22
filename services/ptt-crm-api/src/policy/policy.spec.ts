import { evaluatePolicy } from './policy.engine';
import { PolicyContext } from './policy.types';

describe('PolicyEngine WIN-4-C', () => {
  const releaseCtx = (patch: Partial<PolicyContext> = {}): PolicyContext => ({
    action: 'release',
    handoff_status: 'with_solution',
    has_handoff_activity: true,
    consult_complete: true,
    preliminary_plan_ok: true,
    ...patch,
  });

  it('allows release when handoff path complete', () => {
    const out = evaluatePolicy('presales.no_release_without_handoff', releaseCtx());
    expect(out.allow).toBe(true);
  });

  it('denies release without handoff activity (EC-W4-05)', () => {
    const out = evaluatePolicy(
      'presales.no_release_without_handoff',
      releaseCtx({ has_handoff_activity: false, handoff_status: 'pending' }),
    );
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('presales.no_release_without_handoff');
  });

  it('allows claim for MKT content function', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      job_functions: ['content'],
    });
    expect(out.allow).toBe(true);
  });

  it('denies claim without MKT function or set', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      job_functions: ['sales'],
      permission_sets: ['AM-BASE'],
    });
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('presales.no_claim_without_mkt_set');
  });

  it('allows claim via MKT permission set', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      permission_sets: ['MKT-SOLUTION'],
    });
    expect(out.allow).toBe(true);
  });

  it('denies expired break-glass union', () => {
    const out = evaluatePolicy('rbac.break_glass_not_expired', {
      action: 'break_glass_union',
      break_glass_active: true,
      break_glass_expired: true,
    });
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('rbac.break_glass_not_expired');
  });

  it('allows active break-glass within TTL', () => {
    const out = evaluatePolicy('rbac.break_glass_not_expired', {
      action: 'break_glass_union',
      break_glass_active: true,
      break_glass_expired: false,
    });
    expect(out.allow).toBe(true);
  });
});
