import { describe, expect, it } from 'vitest';
import { parseB2bProjectList } from './b2b-projects-api';

describe('parseB2bProjectList', () => {
  it('parses list from items wrapper', () => {
    const rows = parseB2bProjectList({
      items: [{ id: '1', code: 'seo', name: 'SEO', status: 'active' }],
    });
    expect(rows[0].code).toBe('seo');
  });

  it('parses bare array response', () => {
    const rows = parseB2bProjectList([{ id: '2', code: 'ads', name: 'Ads', status: 'draft' }]);
    expect(rows[0].name).toBe('Ads');
  });

  it('returns empty for invalid body', () => {
    expect(parseB2bProjectList(null)).toEqual([]);
  });
});
