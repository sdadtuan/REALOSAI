import { lifecycleFromVelocity, snapshotFactDiff, velocity } from './pulse-signal.util';

describe('pulse-signal.util', () => {
  it('snapshotFactDiff marks price when 10 becomes 12', () => {
    expect(snapshotFactDiff({ price: '10' }, { price: '12' })).toEqual({
      changed: ['price'],
      topic: 'price',
    });
  });

  it('velocity(100, 130) is 0.3 and maps to rising', () => {
    const v = velocity(100, 130);
    expect(v).toBe(0.3);
    expect(lifecycleFromVelocity(v)).toBe('rising');
  });
});
