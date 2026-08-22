const EDGES: Record<string, readonly string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['done', 'blocked', 'waiting', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  waiting: ['in_progress', 'cancelled'],
  done: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (EDGES[from] ?? []).includes(to);
}

export function isRestrictedQueue(code: string): boolean {
  return [
    'collection_schedule',
    'vbtt_check',
    'hdmb_gate_legal',
    'hdmb_gate_paid',
    'legal_gate_phase',
    'milestone_unlock',
    'commission_period',
    'claim_review',
  ].includes(code);
}
