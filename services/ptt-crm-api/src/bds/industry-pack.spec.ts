import { BDS_PACK, mapWonToRevenue } from './industry-pack';

describe('industry-pack bds', () => {
  it('exposes slug and re_buyer flow', () => {
    expect(BDS_PACK.slug).toBe('bds');
    expect(BDS_PACK.leadFlowKind).toBe('re_buyer');
    expect(BDS_PACK.tenantModes).toEqual(['developer', 'broker', 'hybrid']);
  });

  it('counts deposit as pipeline and contracted as CĐT revenue', () => {
    expect(mapWonToRevenue({ type: 'deposit', amountVnd: 100 })).toEqual({
      kind: 'pipeline',
      amountVnd: 100,
    });
    expect(mapWonToRevenue({ type: 'contracted', amountVnd: 200 })).toEqual({
      kind: 'revenue',
      amountVnd: 200,
    });
  });
});
