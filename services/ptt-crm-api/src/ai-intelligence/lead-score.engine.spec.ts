import { buildTopFeatures, computeLeadScoreV1, sanitizeScoreReasons } from './lead-score.engine';
import { LeadScoreContext } from './lead-score.types';

describe('computeLeadScoreV1', () => {
  const baseCtx: LeadScoreContext = {
    leadId: 1,
    clientId: null,
    channel: 'meta',
    source: 'facebook',
    campaignId: 'camp-1',
    externalLeadId: 'ext-1',
    status: 'new',
    isDuplicate: false,
    receivedAt: new Date('2026-07-26T08:00:00Z'),
    createdAt: new Date('2026-07-26T08:00:00Z'),
    firstContactAt: new Date('2026-07-26T08:10:00Z'),
    timelineEventCount: 2,
    meta: {},
    estimatedDealValueVnd: 80_000_000,
  };

  it('scores meta lead with campaign in hot band', () => {
    const result = computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z'));
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.explainability.score_band).toBe('hot');
    expect(result.top_features.length).toBeGreaterThan(0);
    expect(result.top_features.length).toBeLessThanOrEqual(5);
    expect(result.explainability.factors.some((f) => f.sign === '+')).toBe(true);
  });

  it('top_features omit raw phone numbers', () => {
    const result = computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z'));
    const poisoned = sanitizeScoreReasons([
      ...result.top_features,
      { feature: 'Gọi 0901234567', direction: '+', weight: 1 },
    ]);
    expect(poisoned.some((r) => /0901234567/.test(r.feature))).toBe(false);
  });

  it('flags attribution incomplete without campaign', () => {
    const result = computeLeadScoreV1(
      { ...baseCtx, campaignId: null },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(result.explainability.flags).toContain('attribution_incomplete');
  });

  it('applies duplicate penalty', () => {
    const result = computeLeadScoreV1(
      { ...baseCtx, isDuplicate: true },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(result.explainability.factors.some((f) => f.key === 'duplicate')).toBe(true);
    expect(result.score).toBeLessThan(computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z')).score);
  });

  it('clamps score between 0 and 100', () => {
    const result = computeLeadScoreV1(
      {
        ...baseCtx,
        isDuplicate: true,
        receivedAt: new Date('2026-07-01T08:00:00Z'),
        createdAt: new Date('2026-07-01T08:00:00Z'),
        firstContactAt: null,
        campaignId: null,
        channel: null,
      },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('penalizes CPL over target in explainability', () => {
    const result = computeLeadScoreV1(
      {
        ...baseCtx,
        cplVnd: 150_000,
        targetCplVnd: 100_000,
        cplOverTarget: true,
      },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(result.explainability.factors.some((f) => f.key === 'cpl_over_target')).toBe(true);
    expect(result.explainability.flags).toContain('cpl_over_target');
  });
});
