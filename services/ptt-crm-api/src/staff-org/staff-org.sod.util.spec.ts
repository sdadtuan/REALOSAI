import {
  detectJobFunctionSod,
  normalizeFunctionCodes,
  validateJobFunctionAssignment,
} from './staff-org.sod.util';

describe('staff-org.sod.util', () => {
  it('normalizes and dedupes function codes', () => {
    expect(normalizeFunctionCodes(['content', 'content', 'design', 'invalid'])).toEqual([
      'content',
      'design',
    ]);
  });

  it('blocks content + compliance SoD-02', () => {
    const sod = detectJobFunctionSod(['content', 'compliance']);
    expect(sod?.id).toBe('02');
  });

  it('blocks more than 3 functions', () => {
    const sod = validateJobFunctionAssignment(['leader', 'sales', 'content', 'design']);
    expect(sod?.id).toBe('max');
  });
});
