import { StaffTicketController } from './staff-ticket.controller';

describe('StaffTicketController', () => {
  it('create delegates tenant + staff', async () => {
    const svc = { createTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
    const staffAuth = { hasCapForPosition: jest.fn() };
    const ctl = new StaffTicketController(svc as never, staffAuth as never);
    await ctl.create({ kind: 'dept', queue_code: 'dept_backlog', title: 'hi' }, 't1', {
      staffUser: { sub: '7', position_id: 1 },
    } as never);
    expect(svc.createTicket).toHaveBeenCalledWith(
      7,
      't1',
      expect.objectContaining({ title: 'hi' }),
    );
  });
});
