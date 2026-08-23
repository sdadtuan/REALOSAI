import {
  assertCanEnableLeadForms,
  isMetaAdAccountMapped,
  normalizeMetaAdAccountId,
} from './marketing-config.util';

describe('marketing-config.util', () => {
  it('normalizes ad account id', () => {
    expect(normalizeMetaAdAccountId('1234567890')).toBe('act_1234567890');
    expect(normalizeMetaAdAccountId('act_999')).toBe('act_999');
    expect(normalizeMetaAdAccountId('')).toBe('');
  });

  it('detects mapped ad account', () => {
    expect(isMetaAdAccountMapped('act_1')).toBe(true);
    expect(isMetaAdAccountMapped('')).toBe(false);
  });

  it('blocks forms without ad account', () => {
    expect(() =>
      assertCanEnableLeadForms({ metaAdAccountId: '', webhookEnabled: true }),
    ).toThrow(/ad account/i);
    expect(() =>
      assertCanEnableLeadForms({
        metaAdAccountId: 'act_1',
        webhookEnabled: true,
        forms: [{ form_id: 'f1' }],
      }),
    ).not.toThrow();
  });
});
