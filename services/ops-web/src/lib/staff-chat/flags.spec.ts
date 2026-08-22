import { afterEach, describe, expect, it } from 'vitest';
import { isStaffChatFeEnabled } from './flags';

describe('isStaffChatFeEnabled', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_STAFF_CHAT;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_STAFF_CHAT;
    else process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = prev;
  });

  it('defaults off', () => {
    delete process.env.NEXT_PUBLIC_PTT_STAFF_CHAT;
    expect(isStaffChatFeEnabled()).toBe(false);
  });

  it('on for 1', () => {
    process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = '1';
    expect(isStaffChatFeEnabled()).toBe(true);
  });
});
