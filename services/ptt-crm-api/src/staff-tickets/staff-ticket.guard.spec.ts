import { NotFoundException } from '@nestjs/common';
import { StaffTicketGuard } from './staff-ticket.guard';

describe('StaffTicketGuard', () => {
  const prev = process.env.PTT_STAFF_TICKETS;

  afterEach(() => {
    if (prev === undefined) delete process.env.PTT_STAFF_TICKETS;
    else process.env.PTT_STAFF_TICKETS = prev;
  });

  it('404 when TICKETS off', () => {
    process.env.PTT_STAFF_TICKETS = '0';
    expect(() => new StaffTicketGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when TICKETS on', () => {
    process.env.PTT_STAFF_TICKETS = '1';
    expect(new StaffTicketGuard().canActivate()).toBe(true);
  });
});
