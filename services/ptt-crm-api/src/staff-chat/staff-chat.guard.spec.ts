import { NotFoundException } from '@nestjs/common';
import { StaffChatGuard } from './staff-chat.guard';

describe('StaffChatGuard', () => {
  const prev = process.env.PTT_STAFF_CHAT;

  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_STAFF_CHAT;
    else process.env.PTT_STAFF_CHAT = prev;
  });

  it('404 when CHAT off', () => {
    process.env.PTT_STAFF_CHAT = '0';
    expect(() => new StaffChatGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when CHAT on', () => {
    process.env.PTT_STAFF_CHAT = '1';
    expect(new StaffChatGuard().canActivate()).toBe(true);
  });
});
