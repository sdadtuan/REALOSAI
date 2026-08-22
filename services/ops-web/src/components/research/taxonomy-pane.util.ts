export const TAXONOMY_BANNER = 'Gắn theme — không sửa nội dung insight.';

export function shouldShowTaxonomyNav(canConfigure: boolean): boolean {
  return canConfigure === true;
}
