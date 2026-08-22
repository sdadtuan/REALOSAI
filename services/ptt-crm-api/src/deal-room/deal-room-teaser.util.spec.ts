import {
  buildDealTeaserUrl,
  buildTeaserMailtoHref,
  buildTeaserStrategyBlocks,
  hashDealTeaserToken,
} from './deal-room-teaser.util';

describe('deal-room-teaser.util', () => {
  it('hashes token deterministically', () => {
    const a = hashDealTeaserToken('abc');
    const b = hashDealTeaserToken('abc');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('builds portal teaser URL', () => {
    const url = buildDealTeaserUrl('https://portal.pttads.vn', 'tok123');
    expect(url).toBe('https://portal.pttads.vn/p/deal/tok123');
  });

  it('filters strategy blocks to preliminary keys only', () => {
    const blocks = buildTeaserStrategyBlocks({
      market_message: 'Msg',
      media_reach: 'Reach',
      conversion_strategy: 'Conv',
      referral_engine: 'Hidden',
    });
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.key)).toEqual([
      'market_message',
      'media_reach',
      'conversion_strategy',
    ]);
  });

  it('builds mailto CTA without staff email', () => {
    const href = buildTeaserMailtoHref('ABC Logistics', 'An AM');
    expect(href.startsWith('mailto:?subject=')).toBe(true);
    expect(href.includes('An%20AM') || href.includes('An AM')).toBe(true);
  });
});
