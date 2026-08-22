import { describe, expect, it } from 'vitest';
import { shouldShowTalkwalkerButton, TALKWALKER_SOURCES_BANNER } from './sources-talkwalker.util';

describe('sources-talkwalker.util', () => {
  it('P23 hides Chạy Talkwalker when health.talkwalker_enabled is false', () => {
    expect(shouldShowTalkwalkerButton(false, true)).toBe(false);
    expect(shouldShowTalkwalkerButton(false, false)).toBe(false);
  });

  it('P23 shows Chạy Talkwalker only when talkwalker is enabled and actor can run', () => {
    expect(shouldShowTalkwalkerButton(true, true)).toBe(true);
    expect(shouldShowTalkwalkerButton(true, false)).toBe(false);
  });

  it('P23 banner forbids auto insight', () => {
    expect(TALKWALKER_SOURCES_BANNER).toMatch(/Không tự tạo insight/);
  });
});
