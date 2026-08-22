import { isStaffChatEnabled } from './staff-chat.flags';

describe('staff-chat.flags', () => {
  const prev = process.env.PTT_STAFF_CHAT;

  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_STAFF_CHAT;
    else process.env.PTT_STAFF_CHAT = prev;
  });

  it('defaults CHAT off when unset', () => {
    delete process.env.PTT_STAFF_CHAT;
    expect(isStaffChatEnabled()).toBe(false);
  });

  it('CHAT on for 1', () => {
    process.env.PTT_STAFF_CHAT = '1';
    expect(isStaffChatEnabled()).toBe(true);
  });
});
