import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_VALID_TO_LABEL,
  formatPublishedValidTo,
  publishedValidToFromRow,
} from './published-valid-to.util';

describe('formatPublishedValidTo', () => {
  it('P33 keeps YYYY-MM-DD and trims ISO datetime', () => {
    expect(formatPublishedValidTo('2026-12-31')).toBe('2026-12-31');
    expect(formatPublishedValidTo(' 2026-12-31T15:00:00Z ')).toBe('2026-12-31');
  });

  it('P33 returns null for missing or invalid values', () => {
    expect(formatPublishedValidTo(null)).toBe(null);
    expect(formatPublishedValidTo('')).toBe(null);
    expect(formatPublishedValidTo('soon')).toBe(null);
    expect(formatPublishedValidTo(20261231)).toBe(null);
  });

  it('P33 reads published_valid_to from a report row', () => {
    expect(publishedValidToFromRow({ published_valid_to: '2026-12-31' })).toBe('2026-12-31');
    expect(publishedValidToFromRow({ valid_to: '2020-01-01' })).toBeUndefined();
    expect(publishedValidToFromRow('x')).toBe(null);
  });

  it('P33 label is audit copy not stale banner', () => {
    expect(PUBLISHED_VALID_TO_LABEL).toBe('Hiệu lực lúc gửi');
    expect(PUBLISHED_VALID_TO_LABEL).not.toMatch(/lỗi thời|hết hạn/i);
  });
});
