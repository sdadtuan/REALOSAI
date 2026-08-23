import { describe, expect, it } from 'vitest';
import { w3ActionCopy } from './w3-copy';

describe('w3ActionCopy', () => {
  it('maps scheme / statement / advance errors', () => {
    expect(w3ActionCopy('409 scheme_not_draft')).toMatch(/nháp/i);
    expect(w3ActionCopy('409 scheme_active')).toMatch(/active/i);
    expect(w3ActionCopy('400 split_sum')).toMatch(/100%/);
    expect(w3ActionCopy('409 statement_mismatch')).toMatch(/đối soát/i);
    expect(w3ActionCopy('409 statement_status')).toMatch(/Trạng thái kỳ/i);
    expect(w3ActionCopy('409 period_locked')).toMatch(/khóa/i);
    expect(w3ActionCopy('400 advance_cap')).toMatch(/hạn mức/i);
  });

  it('does not steal w2 row_version', () => {
    expect(w3ActionCopy('409 row_version')).toBe('409 row_version');
  });
});
