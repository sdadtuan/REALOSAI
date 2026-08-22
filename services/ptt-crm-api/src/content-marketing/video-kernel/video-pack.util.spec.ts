import { packSpec } from './video-pack.util';

describe('video-pack.util', () => {
  it('returns reels 1080x1920 max 60', () => {
    expect(packSpec('reels')).toEqual(expect.objectContaining({ width: 1080, height: 1920, maxSec: 60 }));
  });

  it('rejects ads_15 in V1', () => {
    expect(() => packSpec('ads_15')).toThrow(/pack_not_in_v1/);
  });
});
