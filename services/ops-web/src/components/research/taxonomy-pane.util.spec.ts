import { describe, expect, it } from 'vitest';
import { shouldShowTaxonomyNav, TAXONOMY_BANNER } from './taxonomy-pane.util';

describe('taxonomy-pane.util', () => {
  it('keeps taxonomy banner verbatim', () => {
    expect(TAXONOMY_BANNER).toBe('Gắn theme — không sửa nội dung insight.');
  });

  it('hides taxonomy nav unless actor can configure', () => {
    expect(shouldShowTaxonomyNav(false)).toBe(false);
  });

  it('shows taxonomy nav only when actor can configure', () => {
    expect(shouldShowTaxonomyNav(true)).toBe(true);
  });
});
