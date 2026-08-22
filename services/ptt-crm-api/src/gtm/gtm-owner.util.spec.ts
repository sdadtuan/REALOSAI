import { pickRoundRobinOwner } from './gtm-owner.util';

describe('gtm-owner.util', () => {
  it('returns null for empty ids', () => {
    expect(pickRoundRobinOwner([], null)).toBeNull();
  });

  it('returns first id when previous is null', () => {
    expect(pickRoundRobinOwner(['a', 'b'], null)).toBe('a');
  });

  it('round-robins through ids', () => {
    expect(pickRoundRobinOwner(['a', 'b'], 'a')).toBe('b');
    expect(pickRoundRobinOwner(['a', 'b'], 'b')).toBe('a');
  });

  it('returns first id when previous is not in list', () => {
    expect(pickRoundRobinOwner(['a', 'b'], 'z')).toBe('a');
  });
});
