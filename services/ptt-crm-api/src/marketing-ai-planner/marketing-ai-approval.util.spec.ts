import {
  assertApprovalTransition,
  canExportWithApproval,
  versionStatusForDecision,
} from './marketing-ai-approval.util';

describe('marketing-ai-approval.util', () => {
  it('assertApprovalTransition rejects non-pending', () => {
    expect(() => assertApprovalTransition('approved', 'approved')).toThrow(/approval_not_pending/);
  });

  it('versionStatusForDecision maps decisions', () => {
    expect(versionStatusForDecision('approved')).toBe('approved');
    expect(versionStatusForDecision('rejected')).toBe('archived');
    expect(versionStatusForDecision('changes_requested')).toBe('draft');
  });

  it('canExportWithApproval respects flag', () => {
    expect(canExportWithApproval(false, null)).toBe(true);
    expect(canExportWithApproval(true, 'pending')).toBe(false);
    expect(canExportWithApproval(true, 'approved')).toBe(true);
  });
});
