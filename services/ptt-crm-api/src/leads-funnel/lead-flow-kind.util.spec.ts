import {
  assertStatusAllowedForFlow,
  resolveLeadFlowKind,
  statusOptionsForFlowKind,
} from './lead-flow-kind.util';

describe('lead-flow-kind.util', () => {
  it('classifies meta lead with client as spa operational', () => {
    expect(
      resolveLeadFlowKind({
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        channel: 'meta',
        source: 'facebook',
      }),
    ).toBe('spa_operational');
  });

  it('classifies manual referral without client as B2B', () => {
    expect(
      resolveLeadFlowKind({
        clientId: null,
        channel: '',
        source: 'referral',
      }),
    ).toBe('b2b_prospect');
  });

  it('blocks chot on B2B flow', () => {
    expect(() => assertStatusAllowedForFlow('b2b_prospect', 'chot')).toThrow(/B2B Sales/);
  });

  it('blocks won on spa flow', () => {
    expect(() => assertStatusAllowedForFlow('spa_operational', 'won')).toThrow(/CSKH vận hành/);
  });

  it('allows hen_gap only on spa options', () => {
    expect(statusOptionsForFlowKind('spa_operational')).toContain('hen_gap');
    expect(statusOptionsForFlowKind('b2b_prospect')).not.toContain('hen_gap');
    expect(statusOptionsForFlowKind('b2b_prospect')).toContain('won');
  });

  it('classifies explicit re_buyer', () => {
    expect(
      resolveLeadFlowKind({
        metaJson: { lead_flow_kind: 're_buyer' },
      }),
    ).toBe('re_buyer');
  });

  it('classifies re_project_id as re_buyer', () => {
    expect(
      resolveLeadFlowKind({
        metaJson: { re_project_id: 12 },
      }),
    ).toBe('re_buyer');
  });

  it('allows xem_nha on re_buyer options', () => {
    expect(statusOptionsForFlowKind('re_buyer')).toContain('xem_nha');
    expect(statusOptionsForFlowKind('re_buyer')).toContain('giu_cho');
  });
});
