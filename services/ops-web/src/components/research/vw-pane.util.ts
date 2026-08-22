export const VW_TAB_BANNER =
  'Bảng ước lượng giá — mẫu convenience. Không MOE / 95% confidence.';

export function shouldShowVwTab(productType: string): boolean {
  return productType === 'PRICE_OFFER';
}

export function formatVwPoint(value: number | null): string {
  return value == null ? '—' : String(value);
}
