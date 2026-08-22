import { completenessPct, percentile50 } from './ops-analytics.util';

describe('percentile50', () => {
  it('percentile50([10, 20, 30]) === 20', () => {
    expect(percentile50([10, 20, 30])).toBe(20);
  });

  it('returns null for an empty sample', () => {
    expect(percentile50([])).toBeNull();
  });

  it('averages the two middle values for an even-length sample', () => {
    expect(percentile50([10, 20])).toBe(15);
  });
});

describe('completenessPct', () => {
  it('returns 0 when total is 0', () => {
    expect(completenessPct(0, 0)).toBe(0);
  });

  it('rounds percent of projects with verified evidence', () => {
    expect(completenessPct(3, 1)).toBe(33);
  });
});
