export const SPARKTORO_SOURCES_BANNER =
  'Nguồn ước lượng — ghi limitation. Không tự tạo insight.';

export const SPARKTORO_DISABLED_TITLE = 'Cần quyền chạy job và SparkToro đã cấu hình';

export function shouldShowSparktoroButton(sparktoroEnabled: boolean, canRun: boolean): boolean {
  return sparktoroEnabled === true && canRun === true;
}
