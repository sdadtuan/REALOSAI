export type BdsSpineEventType =
  | 'buyer.created'
  | 'hold.created'
  | 'tx.deposit'
  | 'tx.vbtt'
  | 'tx.contracted'
  | 'tx.hdmb_gate'
  | 'legal.gate'
  | 'launch.opened';

export function bdsSpineIdempotencyKey(input: {
  event_type: string;
  aggregate_id: string;
  stage?: string;
}): string {
  const eventType = String(input.event_type ?? '').trim();
  const aggregateId = String(input.aggregate_id ?? '').trim();
  const stage = String(input.stage ?? 'default').trim() || 'default';
  return `${eventType}:${aggregateId}:${stage}`;
}

export const BDS_SPINE_HANDOFF: Record<
  BdsSpineEventType,
  { queue_code: string; entity_type: string; default_stage: string }
> = {
  'buyer.created': { queue_code: 'cskh_first_touch', entity_type: 'lead', default_stage: 'created' },
  'hold.created': { queue_code: 'hold_f1_approve', entity_type: 'hold', default_stage: 'pending' },
  'tx.deposit': { queue_code: 'collection_schedule', entity_type: 'tx', default_stage: 'deposit' },
  'tx.vbtt': { queue_code: 'vbtt_check', entity_type: 'tx', default_stage: 'vbtt' },
  'tx.contracted': { queue_code: 'commission_period', entity_type: 'tx', default_stage: 'contracted' },
  'tx.hdmb_gate': { queue_code: 'hdmb_gate_legal', entity_type: 'tx', default_stage: 'legal' },
  'legal.gate': { queue_code: 'legal_gate_phase', entity_type: 'project', default_stage: 'so_xd' },
  'launch.opened': { queue_code: 'ops_action', entity_type: 'launch', default_stage: 'open' },
};
