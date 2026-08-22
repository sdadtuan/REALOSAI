import { describe, expect, it } from 'vitest';
import { buildPublishBody } from './cms-api';

describe('buildPublishBody', () => {
  it('publish body sends locale flags', () => {
    expect(buildPublishBody({ publishEn: false })).toEqual({ locales: ['vi'] });
    expect(buildPublishBody({ publishEn: true })).toEqual({ locales: ['vi', 'en'] });
  });
});
