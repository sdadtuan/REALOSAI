import { buildReviewQueueAiSummary } from './review-queue-intelligence.util';

describe('review-queue-intelligence.util', () => {
  it('builds summary line with suggested owner', () => {
    const out = buildReviewQueueAiSummary({
      leadId: 42,
      fullName: 'Lan',
      status: 'moi',
      hoursWaiting: 26,
      firstCallAt: null,
      b2CompletedAt: null,
      ownerId: 5,
      ownerName: 'Old Rep',
      bestOwnerId: 8,
      bestOwnerName: 'Top Rep',
    });
    expect(out.summary_line).toContain('26h');
    expect(out.suggested_owner_id).toBe(8);
    expect(out.root_cause).toBe('no_call');
  });
});
