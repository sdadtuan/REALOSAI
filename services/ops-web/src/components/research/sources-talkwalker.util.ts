export const TALKWALKER_SOURCES_BANNER =
  'Nguồn social công khai (stub bake-off) — ghi limitation. Không tự tạo insight.';

export const TALKWALKER_DISABLED_TITLE = 'Cần quyền chạy job và Talkwalker đã cấu hình';

export function shouldShowTalkwalkerButton(talkwalkerEnabled: boolean, canRun: boolean): boolean {
  return talkwalkerEnabled === true && canRun === true;
}
