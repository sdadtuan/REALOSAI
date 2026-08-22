import { shouldResolveArrivalAlert } from './b2b-alert-resolve.util';

describe('shouldResolveArrivalAlert', () => {
  it('resolves on human call only', () => {
    expect(shouldResolveArrivalAlert('human')).toBe(true);
    expect(shouldResolveArrivalAlert('ai')).toBe(false);
  });
});
