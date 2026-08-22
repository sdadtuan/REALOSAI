import {
  assertCanAdvanceConsultToProposal,
  assertCanMutatePresalesConsult,
  assertPresalesSolutionCap,
  hasPresalesSolutionCap,
} from './presales-solution-rbac.util';

describe('presales-solution-rbac.util', () => {
  const solutionEdit = [{ section: 'crm_presales_solution', action: 'edit' }];
  const solutionRelease = [{ section: 'crm_presales_solution', action: 'release' }];
  const amView = [{ section: 'crm_presales_solution', action: 'view' }];
  const gdkd = [{ section: 'crm_leads', action: 'assign' }];

  it('detects solution caps', () => {
    expect(hasPresalesSolutionCap(solutionEdit, 'edit')).toBe(true);
    expect(hasPresalesSolutionCap(amView, 'edit')).toBe(false);
  });

  it('blocks AM consult edit during active handoff', () => {
    expect(() =>
      assertCanMutatePresalesConsult(amView, 'with_solution', 'consult'),
    ).toThrow(/Solution/);
    expect(() =>
      assertCanMutatePresalesConsult(solutionEdit, 'with_solution', 'consult'),
    ).not.toThrow();
  });

  it('allows legacy consult edit without handoff', () => {
    expect(() => assertCanMutatePresalesConsult(amView, '', 'consult')).not.toThrow();
  });

  it('blocks AM advance consult→proposal without release cap', () => {
    expect(() => assertCanAdvanceConsultToProposal(amView, 'with_solution')).toThrow(
      /Solution/,
    );
    expect(() =>
      assertCanAdvanceConsultToProposal(solutionRelease, 'with_solution'),
    ).not.toThrow();
    expect(() => assertCanAdvanceConsultToProposal(gdkd, 'with_solution', { gdkdAssign: true })).not.toThrow();
  });

  it('assertPresalesSolutionCap allows GDKD override for claim', () => {
    expect(() => assertPresalesSolutionCap(gdkd, 'claim', { gdkdAssign: true })).not.toThrow();
    expect(() => assertPresalesSolutionCap(amView, 'claim')).toThrow();
  });
});
