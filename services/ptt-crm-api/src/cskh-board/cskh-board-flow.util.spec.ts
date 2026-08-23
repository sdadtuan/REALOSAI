import { resolveCskhBoardFlow } from './cskh-board-flow.util';

describe('resolveCskhBoardFlow', () => {
  it('U-02 requested re_buyer with bds_buyers', () => {
    expect(
      resolveCskhBoardFlow({
        requested: 're_buyer',
        hasCrmLeadsView: false,
        hasBdsBuyersView: true,
      }),
    ).toBe('re_buyer');
  });

  it('forces re_buyer when only bds_buyers and no flow', () => {
    expect(
      resolveCskhBoardFlow({
        requested: undefined,
        hasCrmLeadsView: false,
        hasBdsBuyersView: true,
      }),
    ).toBe('re_buyer');
  });

  it('keeps spa default for crm_leads without flow', () => {
    expect(
      resolveCskhBoardFlow({
        requested: undefined,
        hasCrmLeadsView: true,
        hasBdsBuyersView: false,
      }),
    ).toBe('spa');
  });

  it('forbids board when neither cap', () => {
    expect(
      resolveCskhBoardFlow({
        requested: 're_buyer',
        hasCrmLeadsView: false,
        hasBdsBuyersView: false,
      }),
    ).toBeNull();
  });
});
