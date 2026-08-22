import {
  EDIT_WINDOW_MS,
  canEditMessage,
  isRestrictedCode,
  launchHuddleCode,
} from './staff-chat.util';

describe('staff-chat.util', () => {
  it('BDS-43: edit allowed within 15 minutes', () => {
    const created = new Date('2026-08-22T10:00:00Z');
    const now = new Date('2026-08-22T10:14:59Z');
    expect(canEditMessage(created, now)).toBe(true);
  });

  it('BDS-43: edit after 15 minutes denied', () => {
    const created = new Date('2026-08-22T10:00:00Z');
    const now = new Date('2026-08-22T10:15:01Z');
    expect(canEditMessage(created, now)).toBe(false);
    expect(EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it('restricted seed codes', () => {
    expect(isRestrictedCode('ban_phap_che')).toBe(true);
    expect(isRestrictedCode('ban_kd')).toBe(false);
  });

  it('huddle code from launch id', () => {
    expect(launchHuddleCode('L1')).toBe('launch_L1');
  });
});
