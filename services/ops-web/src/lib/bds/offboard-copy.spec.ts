import { describe, expect, it } from 'vitest';
import { offboardHoldDisclaimer, offboardHoldSummary } from './offboard-copy';

describe('offboard-copy', () => {
  it('warns U-07 / U-08 before confirm', () => {
    const text = offboardHoldDisclaimer();
    expect(text).toMatch(/chưa cọc/i);
    expect(text).toMatch(/đã cọc/i);
    expect(text).not.toMatch(/xóa căn/i);
  });

  it('summarizes counts after success', () => {
    expect(
      offboardHoldSummary({ holds_released: 1, holds_kept: 2, tickets_reassigned: 3 }),
    ).toMatch(/mở 1/);
    expect(
      offboardHoldSummary({ holds_released: 1, holds_kept: 2, tickets_reassigned: 3 }),
    ).toMatch(/giữ 2/);
  });
});
