import {
  assertNoB2bProjectOnReBuyer,
  normalizeNeedJson,
  qualifyBuyerEligible,
} from './bds-buyer.util';

describe('bds-buyer.util', () => {
  it('BDS-07 re_buyer + b2b_project_id → 400', () => {
    expect(() =>
      assertNoB2bProjectOnReBuyer({
        leadFlowKind: 're_buyer',
        b2bProjectId: 'uuid-1',
      }),
    ).toThrow(
      expect.objectContaining({ response: { error: 'b2b_project_forbidden' } }),
    );
  });

  it('qualify requires da_lien_he + phone', () => {
    expect(qualifyBuyerEligible('moi', '84901234567')).toBe(false);
    expect(qualifyBuyerEligible('da_lien_he', '84901234567')).toBe(true);
  });

  it('normalizeNeedJson returns object', () => {
    expect(normalizeNeedJson({ pn: 2 })).toEqual({ pn: 2 });
    expect(normalizeNeedJson(null)).toEqual({});
  });
});
