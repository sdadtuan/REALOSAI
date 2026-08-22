import { assertPaidEstimateTier, assertSimilarwebTier, sanitizeCompetitorFact } from './competitor-snapshot.util';

describe('sanitizeCompetitorFact', () => {
  it('drops fact key secret_sauce', () => {
    const out = sanitizeCompetitorFact({
      price: '12000',
      secret_sauce: 'never persist',
    });
    expect(out).toEqual({ price: '12000' });
    expect(out).not.toHaveProperty('secret_sauce');
  });
});

describe('assertSimilarwebTier', () => {
  it('throws reliability_capped for publisher Similarweb with tier high', () => {
    expect(() =>
      assertSimilarwebTier({
        publisher: 'Similarweb',
        reliability_tier: 'high',
        limitation_note: 'Paid panel estimate',
      }),
    ).toThrow('reliability_capped');
    try {
      assertSimilarwebTier({
        publisher: 'Similarweb',
        reliability_tier: 'high',
        limitation_note: 'Paid panel estimate',
      });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('reliability_capped');
    }
  });

  it('M3-1a: url containing sparktoro.com + tier high is reliability_capped', () => {
    expect(() =>
      assertPaidEstimateTier({
        url: 'https://sparktoro.com/audience/example',
        reliability_tier: 'high',
        limitation_note: 'Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”.',
      }),
    ).toThrow('reliability_capped');
    try {
      assertPaidEstimateTier({
        url: 'https://sparktoro.com/audience/example',
        reliability_tier: 'high',
        limitation_note: 'Ước lượng audience SparkToro — không phải census. Không suy “người Việt nghĩ rằng…”.',
      });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('reliability_capped');
    }
  });

  it('P23 url/publisher talkwalker + tier high is reliability_capped', () => {
    expect(() =>
      assertPaidEstimateTier({
        publisher: 'Talkwalker',
        url: 'https://news.example/a',
        reliability_tier: 'high',
        limitation_note: 'x',
      }),
    ).toThrow('reliability_capped');
  });

  it('M3-1b: SparkToro medium tier with empty limitation is limitation_required', () => {
    expect(() =>
      assertPaidEstimateTier({
        publisher: 'SparkToro',
        reliability_tier: 'medium',
        limitation_note: '',
      }),
    ).toThrow('limitation_required');
    try {
      assertPaidEstimateTier({
        publisher: 'SparkToro',
        reliability_tier: 'medium',
        limitation_note: '   ',
      });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('limitation_required');
    }
  });
});
