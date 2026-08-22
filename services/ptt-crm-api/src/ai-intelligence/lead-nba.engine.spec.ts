import { computeLeadNbaV1 } from './lead-nba.engine';
import { LeadScoreContext } from './lead-score.types';

describe('computeLeadNbaV1', () => {
  const base: LeadScoreContext = {
    leadId: 1,
    clientId: null,
    channel: 'meta',
    source: 'meta',
    campaignId: null,
    externalLeadId: null,
    status: 'new',
    isDuplicate: false,
    receivedAt: new Date('2026-07-01T00:00:00Z'),
    createdAt: new Date('2026-07-01T00:00:00Z'),
    firstContactAt: null,
    timelineEventCount: 0,
    meta: {},
    estimatedDealValueVnd: null,
  };

  it('marks lead stalled when no contact for 3+ days', () => {
    const out = computeLeadNbaV1(base, { now: new Date('2026-07-05T00:00:00Z') });
    expect(out.isStalled).toBe(true);
    expect(out.stalledDays).toBeGreaterThanOrEqual(3);
  });

  it('requires 7 days since last activity when contact exists', () => {
    const out = computeLeadNbaV1(
      { ...base, firstContactAt: new Date('2026-07-01T00:00:00Z') },
      { lastActivityAt: new Date('2026-07-01T00:00:00Z'), now: new Date('2026-07-08T00:00:00Z') },
    );
    expect(out.isStalled).toBe(true);
  });

  it('not stalled within 2 days of receive without contact', () => {
    const out = computeLeadNbaV1(base, { now: new Date('2026-07-02T12:00:00Z') });
    expect(out.isStalled).toBe(false);
  });
});
