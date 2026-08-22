import { resolveProductStatusForSave } from './bds-product-status-save.util';

describe('resolveProductStatusForSave', () => {
  it('update without payload status keeps existing (PACK=1 price edit)', () => {
    expect(resolveProductStatusForSave('sold', undefined, true)).toBe('sold');
    expect(resolveProductStatusForSave('locked', undefined, true)).toBe('locked');
  });

  it('create without payload status defaults available', () => {
    expect(resolveProductStatusForSave(undefined, undefined, false)).toBe('available');
  });

  it('explicit payload status wins on create and update', () => {
    expect(resolveProductStatusForSave('sold', 'locked', true)).toBe('locked');
    expect(resolveProductStatusForSave(undefined, 'locked', false)).toBe('locked');
  });
});
