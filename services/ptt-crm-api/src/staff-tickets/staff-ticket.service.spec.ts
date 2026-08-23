import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { StaffTicketService } from './staff-ticket.service';

describe('StaffTicketService', () => {
  const repo = {
    upsertQueue: jest.fn(),
    listQueues: jest.fn().mockResolvedValue([]),
    getQueue: jest.fn(),
    nextNumber: jest.fn().mockResolvedValue('T-1'),
    insertTicket: jest.fn(),
    getById: jest.fn(),
    getByIdempotencyKey: jest.fn().mockResolvedValue(null),
    getOpenByEntity: jest.fn().mockResolvedValue(null),
    listTickets: jest.fn(),
    updateTicket: jest.fn(),
    insertEvent: jest.fn(),
    addWatcher: jest.fn(),
    listWatchers: jest.fn().mockResolvedValue([]),
    insertComment: jest.fn(),
    latestCommentLen: jest.fn().mockResolvedValue(0),
    countInstallments: jest.fn().mockResolvedValue(0),
    getStaffDepartmentCode: jest.fn().mockResolvedValue('ban_kd'),
    listStaffIdsByDepartmentCodes: jest.fn().mockResolvedValue([]),
    markSlaBreachedDue: jest.fn().mockResolvedValue([]),
    listOpenByEntityQueues: jest.fn().mockResolvedValue([]),
    getLatestSlaRemainingMs: jest.fn().mockResolvedValue(null),
    exportRows: jest.fn().mockResolvedValue([]),
    listComments: jest.fn().mockResolvedValue([]),
    listEvents: jest.fn().mockResolvedValue([]),
    listStaffIdsByDeptAndPosition: jest.fn().mockResolvedValue([]),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer', id: 't1' }) };
  let svc: StaffTicketService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer', id: 't1' });
    repo.getStaffDepartmentCode.mockResolvedValue('ban_kd');
    svc = new StaffTicketService(repo as never, tenants as never);
  });

  it('BDS-44: broker listTickets → 404', async () => {
    tenants.getMe.mockResolvedValue({ mode: 'broker' });
    await expect(svc.listTickets(7, 't1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BDS-45: cross same dept → 400', async () => {
    repo.getQueue.mockResolvedValue({
      code: 'dept_backlog',
      kind_default: 'dept',
      assignee_dept_code: null,
      sla_minutes: null,
    });
    await expect(
      svc.createTicket(7, 't1', { kind: 'cross', queue_code: 'dept_backlog', title: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BDS-46: assign staff outside assignee_dept → 400', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'open',
      assignee_dept_code: 'ban_tc_collection',
    });
    repo.getStaffDepartmentCode.mockResolvedValueOnce('ban_tc_collection');
    repo.getStaffDepartmentCode.mockResolvedValueOnce('ban_kenh');
    await expect(svc.assign('tk1', 1, { staff_id: 99 }, 't1')).rejects.toMatchObject({
      response: { error: 'assignee_dept' },
    });
  });

  it('BDS-47: done collection_schedule without installment → 400 artifact', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'in_progress',
      queue_code: 'collection_schedule',
      entity_type: 'tx',
      entity_id: 'tx1',
    });
    repo.getQueue.mockResolvedValue({
      code: 'collection_schedule',
      close_requires: { type: 'installments_exist' },
    });
    repo.countInstallments.mockResolvedValue(0);
    await expect(svc.transition('tk1', 7, { to: 'done' }, 't1')).rejects.toMatchObject({
      response: { error: 'artifact' },
    });
  });

  it('hdmb_gate cannot done by staff', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'in_progress',
      queue_code: 'hdmb_gate_legal',
    });
    repo.getQueue.mockResolvedValue({
      close_requires: { type: 'system_only' },
    });
    await expect(svc.transition('tk1', 7, { to: 'done' }, 't1')).rejects.toMatchObject({
      response: { error: 'system_only' },
    });
  });

  it('createHandoffTicket is idempotent on open entity+queue', async () => {
    repo.getQueue.mockResolvedValue({
      code: 'collection_schedule',
      sla_minutes: 240,
      assignee_dept_code: 'ban_tc_collection',
    });
    repo.getOpenByEntity.mockResolvedValue({ id: 'tk1', queue_code: 'collection_schedule' });
    const out = await svc.createHandoffTicket('t1', {
      queue_code: 'collection_schedule',
      title: 'Cọc',
      body: '',
      entity_type: 'tx',
      entity_id: 'tx1',
    });
    expect(out?.id).toBe('tk1');
    expect(repo.insertTicket).not.toHaveBeenCalled();
  });

  it('createHandoffTicket replays by idempotency_key even when done', async () => {
    repo.getByIdempotencyKey.mockResolvedValue({
      id: 'tk-old',
      status: 'done',
      queue_code: 'hold_f1_approve',
    });
    const out = await svc.createHandoffTicket('t1', {
      queue_code: 'hold_f1_approve',
      title: 'Duyệt',
      body: '',
      entity_type: 'hold',
      entity_id: 'h1',
      idempotency_key: 'hold.created:h1:pending',
    });
    expect(out?.id).toBe('tk-old');
    expect(repo.insertTicket).not.toHaveBeenCalled();
  });

  it('createHandoffTicket stores idempotency_key on insert', async () => {
    repo.getByIdempotencyKey.mockResolvedValue(null);
    repo.getOpenByEntity.mockResolvedValue(null);
    repo.getQueue.mockResolvedValue({
      code: 'hold_f1_approve',
      sla_minutes: 120,
      assignee_dept_code: 'ban_kd',
    });
    repo.nextNumber.mockResolvedValue('ST-1');
    repo.insertTicket.mockResolvedValue({ id: 'tk-new' });
    await svc.createHandoffTicket('t1', {
      queue_code: 'hold_f1_approve',
      title: 'Duyệt',
      body: '',
      entity_type: 'hold',
      entity_id: 'h1',
      idempotency_key: 'hold.created:h1:pending',
    });
    expect(repo.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: 'hold.created:h1:pending' }),
    );
  });

  it('createHandoffTicket 23505 returns existing by key', async () => {
    repo.getByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'tk-race', queue_code: 'hold_f1_approve' });
    repo.getOpenByEntity.mockResolvedValue(null);
    repo.getQueue.mockResolvedValue({
      code: 'hold_f1_approve',
      sla_minutes: 120,
      assignee_dept_code: 'ban_kd',
    });
    repo.nextNumber.mockResolvedValue('ST-2');
    repo.insertTicket.mockRejectedValue({ code: '23505' });
    const out = await svc.createHandoffTicket('t1', {
      queue_code: 'hold_f1_approve',
      title: 'Duyệt',
      body: '',
      entity_type: 'hold',
      entity_id: 'h1',
      idempotency_key: 'hold.created:h1:pending',
    });
    expect(out?.id).toBe('tk-race');
  });

  it('BDS-56: waiting on vbtt_check pauses SLA clock', async () => {
    const due = new Date(Date.now() + 60_000);
    repo.getById.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'in_progress',
      queue_code: 'vbtt_check',
      sla_due_at: due,
    });
    repo.getQueue.mockResolvedValue({
      code: 'vbtt_check',
      sla_pauses_on_waiting: true,
      close_requires: { type: 'none' },
    });
    repo.updateTicket.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'waiting',
      queue_code: 'vbtt_check',
      sla_due_at: null,
    });
    await svc.transition('tk1', 7, { to: 'waiting', reason: 'chờ PC' }, 't1');
    expect(repo.insertEvent).toHaveBeenCalledWith(
      'tk1',
      'sla_pause',
      7,
      expect.objectContaining({ sla_remaining_ms: expect.any(Number) }),
    );
    expect(repo.updateTicket).toHaveBeenCalledWith(
      'tk1',
      expect.objectContaining({ status: 'waiting', sla_due_at: null }),
    );
  });

  it('BDS-55: systemTransition closes collection_schedule', async () => {
    repo.getById.mockResolvedValue({
      id: 'tk1',
      tenant_id: 't1',
      status: 'in_progress',
      queue_code: 'collection_schedule',
      entity_type: 'tx',
      entity_id: 'tx1',
      assignee_staff_id: 7,
      requester_staff_id: 1,
    });
    repo.getQueue.mockResolvedValue({
      close_requires: { type: 'installments_exist' },
    });
    repo.countInstallments.mockResolvedValue(2);
    repo.updateTicket.mockResolvedValue({
      id: 'tk1',
      status: 'done',
      tenant_id: 't1',
      queue_code: 'collection_schedule',
    });
    const out = await svc.systemTransition('tk1', 't1', { to: 'done', reason: 'schedule_created' });
    expect(out?.status).toBe('done');
  });

  it('exportCsv returns header row', async () => {
    repo.exportRows.mockResolvedValue([
      {
        number: 'T-1',
        queue_code: 'ops_action',
        title: 'Test',
        status: 'open',
        assignee_dept_code: 'ban_kd',
        sla_due_at: null,
        entity_type: null,
        entity_id: null,
      },
    ]);
    const csv = await svc.exportCsv(7, 't1', {});
    expect(csv).toContain('number,queue,title');
    expect(csv).toContain('T-1');
  });
});
