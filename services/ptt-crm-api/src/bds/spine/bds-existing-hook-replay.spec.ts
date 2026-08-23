import { replayHandoffTicket } from './bds-existing-hook-replay';

describe('replayHandoffTicket', () => {
  it('calls createHandoffTicket with spine key', async () => {
    const tickets = { createHandoffTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
    await replayHandoffTicket(tickets as never, 't1', {
      event_type: 'hold.created',
      aggregate_id: 'h1',
      title: 'Duyệt hold',
      body: 'SP 9',
      requester_dept_code: 'ban_kenh',
      project_id: 7,
    });
    expect(tickets.createHandoffTicket).toHaveBeenCalledWith('t1', {
      queue_code: 'hold_f1_approve',
      title: 'Duyệt hold',
      body: 'SP 9',
      entity_type: 'hold',
      entity_id: 'h1',
      requester_dept_code: 'ban_kenh',
      project_id: 7,
      idempotency_key: 'hold.created:h1:pending',
    });
  });

  it('no-ops when tickets is null', async () => {
    await expect(
      replayHandoffTicket(null, 't1', {
        event_type: 'hold.created',
        aggregate_id: 'h1',
        title: 'x',
        body: '',
      }),
    ).resolves.toBeNull();
  });
});
