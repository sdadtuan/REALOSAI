import { describe, expect, it } from 'vitest';
import { shouldRingHotAlarm } from './b2b-hot-alarm';

describe('shouldRingHotAlarm', () => {
  it('rings urgent in hours unread', () => {
    expect(
      shouldRingHotAlarm({ severity: 'urgent', inHours: true, leadOpen: false, elapsedMs: 0 }),
    ).toBe(true);
  });

  it('stops after 30s', () => {
    expect(
      shouldRingHotAlarm({ severity: 'urgent', inHours: true, leadOpen: false, elapsedMs: 31_000 }),
    ).toBe(false);
  });

  it('silent outside hours', () => {
    expect(
      shouldRingHotAlarm({ severity: 'urgent', inHours: false, leadOpen: false, elapsedMs: 0 }),
    ).toBe(false);
  });

  it('silent when lead detail open', () => {
    expect(
      shouldRingHotAlarm({ severity: 'urgent', inHours: true, leadOpen: true, elapsedMs: 0 }),
    ).toBe(false);
  });

  it('silent for non-urgent', () => {
    expect(
      shouldRingHotAlarm({ severity: 'normal', inHours: true, leadOpen: false, elapsedMs: 0 }),
    ).toBe(false);
  });
});
