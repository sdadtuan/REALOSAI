export type GtmStatus =
  | 'new'
  | 'qualified'
  | 'disqualified'
  | 'demo_booked'
  | 'sandbox_granted'
  | 'won'
  | 'lost';

const ALLOWED: Record<GtmStatus, readonly GtmStatus[]> = {
  new: ['qualified', 'disqualified'],
  qualified: ['demo_booked', 'disqualified'],
  demo_booked: ['won', 'lost', 'sandbox_granted'],
  sandbox_granted: ['won', 'lost'],
  disqualified: [],
  won: [],
  lost: [],
};

export function canTransitionGtmStatus(from: GtmStatus, to: GtmStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
