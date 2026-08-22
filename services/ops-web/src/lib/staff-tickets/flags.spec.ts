import { describe, expect, it, afterEach } from 'vitest';
import { isStaffTicketsFeEnabled } from './flags';

describe('isStaffTicketsFeEnabled', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS;
    else process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = prev;
  });

  it('defaults off', () => {
    delete process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS;
    expect(isStaffTicketsFeEnabled()).toBe(false);
  });

  it('on for 1', () => {
    process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = '1';
    expect(isStaffTicketsFeEnabled()).toBe(true);
  });
});
