export const PORTAL_CJ_BANNER =
  'Conjoint lite — đếm mức được chọn theo thuộc tính trên mẫu convenience. Không suy diễn thống kê. Không market share.';

export function formatSharePct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
