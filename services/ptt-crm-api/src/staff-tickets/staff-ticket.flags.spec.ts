import { isStaffTicketsEnabled } from './staff-ticket.flags';

describe('staff-ticket.flags', () => {
  const prev = process.env.PTT_STAFF_TICKETS;

  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_STAFF_TICKETS;
    else process.env.PTT_STAFF_TICKETS = prev;
  });

  it('defaults TICKETS off when unset', () => {
    delete process.env.PTT_STAFF_TICKETS;
    expect(isStaffTicketsEnabled()).toBe(false);
  });

  it('TICKETS on for 1', () => {
    process.env.PTT_STAFF_TICKETS = '1';
    expect(isStaffTicketsEnabled()).toBe(true);
  });
});
