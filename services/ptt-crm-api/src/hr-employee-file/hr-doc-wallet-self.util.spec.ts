import { canSelfSubmitCategory } from './hr-doc-wallet-self.util';

describe('hr-doc-wallet-self.util', () => {
  it('allows cert and education for self-submit', () => {
    expect(canSelfSubmitCategory('cert')).toBe(true);
    expect(canSelfSubmitCategory('education')).toBe(true);
  });

  it('blocks identity and contract for self-submit', () => {
    expect(canSelfSubmitCategory('identity')).toBe(false);
    expect(canSelfSubmitCategory('contract')).toBe(false);
  });
});
