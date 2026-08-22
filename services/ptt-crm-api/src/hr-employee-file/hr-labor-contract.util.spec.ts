import { computeContractDisplayStatus, isContractExpiringSoon, maskSalary } from './hr-labor-contract.util';

describe('hr-labor-contract.util', () => {
  it('computeContractDisplayStatus marks expiring within 30 days', () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    expect(
      computeContractDisplayStatus({ status: 'active', kind: 'fixed', expires_on: soon }),
    ).toBe('expiring');
  });

  it('isContractExpiringSoon false for indefinite', () => {
    expect(isContractExpiringSoon(null, 'indefinite')).toBe(false);
  });

  it('maskSalary hides without PII cap', () => {
    expect(maskSalary(15_000_000, false)).toBeNull();
    expect(maskSalary(15_000_000, true)).toBe(15_000_000);
  });
});
