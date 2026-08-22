import { canTransition, isRestrictedQueue } from './staff-ticket.util';

describe('staff-ticket.util', () => {
  it('open → in_progress and cancelled', () => {
    expect(canTransition('open', 'in_progress')).toBe(true);
    expect(canTransition('open', 'cancelled')).toBe(true);
    expect(canTransition('open', 'done')).toBe(false);
  });

  it('in_progress → done | blocked | waiting', () => {
    expect(canTransition('in_progress', 'done')).toBe(true);
    expect(canTransition('in_progress', 'blocked')).toBe(true);
    expect(canTransition('blocked', 'in_progress')).toBe(true);
    expect(canTransition('done', 'open')).toBe(false);
  });

  it('restricted queue codes', () => {
    expect(isRestrictedQueue('hdmb_gate_legal')).toBe(true);
    expect(isRestrictedQueue('collection_schedule')).toBe(true);
    expect(isRestrictedQueue('dept_backlog')).toBe(false);
  });
});
