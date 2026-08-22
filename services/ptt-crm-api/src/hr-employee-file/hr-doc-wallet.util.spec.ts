import { computeDocCardStatus, computeWalletCompleteness } from './hr-doc-wallet.util';

describe('hr-doc-wallet.util', () => {
  it('computeDocCardStatus marks expiring within 30 days', () => {
    const in20 = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    expect(computeDocCardStatus(in20)).toBe('expiring');
  });

  it('computeWalletCompleteness counts required types with files', () => {
    const pct = computeWalletCompleteness(
      [
        {
          type_code: 'cccd_front',
          label: 'CCCD',
          category: 'identity',
          is_system: true,
          is_required_onboard: true,
          is_required_official: false,
          sort_order: 1,
        },
        {
          type_code: 'cccd_back',
          label: 'CCCD sau',
          category: 'identity',
          is_system: true,
          is_required_onboard: true,
          is_required_official: false,
          sort_order: 2,
        },
      ],
      [
        { type_code: 'cccd_front', status: 'valid', file_count: 1 },
        { type_code: 'cccd_back', status: 'valid', file_count: 0 },
      ],
    );
    expect(pct).toBe(50);
  });
});
