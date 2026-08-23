import { BDS_SPINE_HANDOFF, bdsSpineIdempotencyKey } from './bds-spine-idempotency';

describe('bdsSpineIdempotencyKey', () => {
  it('joins event_type:aggregate_id:stage', () => {
    expect(
      bdsSpineIdempotencyKey({
        event_type: 'hold.created',
        aggregate_id: 'h-abc',
        stage: 'pending',
      }),
    ).toBe('hold.created:h-abc:pending');
  });

  it('defaults stage to default', () => {
    expect(
      bdsSpineIdempotencyKey({ event_type: 'buyer.created', aggregate_id: '9' }),
    ).toBe('buyer.created:9:default');
  });
});

describe('BDS_SPINE_HANDOFF', () => {
  it('maps hold.created to hold_f1_approve', () => {
    expect(BDS_SPINE_HANDOFF['hold.created'].queue_code).toBe('hold_f1_approve');
    expect(BDS_SPINE_HANDOFF['buyer.created'].queue_code).toBe('cskh_first_touch');
    expect(BDS_SPINE_HANDOFF['tx.deposit'].queue_code).toBe('collection_schedule');
  });
});
