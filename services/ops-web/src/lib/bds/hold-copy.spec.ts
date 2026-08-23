import { describe, expect, it } from 'vitest';
import { holdActionError, holdConflictCopy } from './hold-copy';

describe('holdConflictCopy', () => {
  it('maps 409 unit_locked to Vietnamese', () => {
    expect(holdConflictCopy('409 unit_locked')).toMatch(/đã có giữ chỗ/i);
  });

  it('passes through other errors', () => {
    expect(holdConflictCopy('400 bad_row')).toBe('400 bad_row');
  });

  it('does not map 409 hold_closed to unit-locked copy', () => {
    expect(holdConflictCopy('409 hold_closed')).toBe('409 hold_closed');
  });
});

describe('holdActionError', () => {
  it('applies conflict copy only on create', () => {
    expect(holdActionError('create', '409 unit_locked')).toMatch(/đã có giữ chỗ/i);
    expect(holdActionError('approve', '409 hold_closed')).toBe('409 hold_closed');
    expect(holdActionError('reject', '409 hold_closed')).toBe('409 hold_closed');
    expect(holdActionError('cancel', '409 hold_closed')).toBe('409 hold_closed');
  });

  it('falls back to generic copy when message is empty', () => {
    expect(holdActionError('approve', '')).toBe('Thao tác thất bại');
  });
});
