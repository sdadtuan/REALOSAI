import {
  formatInternalCode,
  nextInternalCodeFromMax,
  parseInternalCodeSeq,
} from './staff-org-internal-code.util';

describe('staff-org-internal-code.util', () => {
  it('formats PTTCN sequence', () => {
    expect(formatInternalCode(100001)).toBe('PTTCN100001');
    expect(formatInternalCode(100002)).toBe('PTTCN100002');
  });

  it('parses internal code sequence', () => {
    expect(parseInternalCodeSeq('PTTCN100001')).toBe(100001);
    expect(parseInternalCodeSeq('invalid')).toBeNull();
  });

  it('increments from max or starts at 100001', () => {
    expect(nextInternalCodeFromMax(null)).toBe('PTTCN100001');
    expect(nextInternalCodeFromMax(100001)).toBe('PTTCN100002');
  });
});
