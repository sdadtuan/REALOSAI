import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BdsAftersalesService } from './bds-aftersales.service';

function tx(over: Record<string, unknown> = {}) {
  return {
    id: 'tx1',
    tenant_id: 't1',
    project_id: 1,
    product_id: 9,
    stage: 'contracted',
    contract_no: 'HD-1',
    title_status: 'not_started',
    handover_appointment_at: null,
    handover_at: null,
    title_issued_at: null,
    ...over,
  };
}

describe('BdsAftersalesService', () => {
  const asRepo = {
    listBoard: jest.fn(),
    listChecks: jest.fn(),
    upsertCheck: jest.fn(),
    listTickets: jest.fn(),
    insertTicket: jest.fn(),
    updateTicketStatus: jest.fn(),
    countOpenDefects: jest.fn(),
    seedChecksIfEmpty: jest.fn(),
  };
  const txRepo = {
    getTx: jest.fn(),
    setStageIf: jest.fn(),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer' }) };
  const commission = { onTxStage: jest.fn() };
  let svc: BdsAftersalesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer' });
    process.env.PTT_BDS_COMMISSION = '0';
    svc = new BdsAftersalesService(
      asRepo as never,
      txRepo as never,
      tenants as never,
      commission as never,
    );
    txRepo.getTx.mockResolvedValue(tx());
    asRepo.listChecks.mockResolvedValue([]);
    asRepo.listTickets.mockResolvedValue([]);
  });

  it('BDS-38 handover without checklist → 400 handover_checklist', async () => {
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await svc.handover('tx1', { waive: false }, 't1');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'handover_checklist' });
    }
  });

  it('handover after 4 pass → handed_over', async () => {
    asRepo.listChecks.mockResolvedValue(
      ['water', 'electric', 'interior', 'minutes'].map((item_code) => ({ item_code, status: 'pass' })),
    );
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'handed_over' }));
    const out = await svc.handover('tx1', { waive: false }, 't1');
    expect(out.stage).toBe('handed_over');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'handed_over',
      expect.objectContaining({ handover_at: expect.any(Date) }),
      'contracted',
    );
  });

  it('waive without approve → 400 handover_waive', async () => {
    await expect(
      svc.handover('tx1', { waive: true, waive_reason: 'KH nhận thô', hasApproveCap: false }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'handover_waive' } });
  });

  it('wrong stage → 409 tx_stage', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'deposit' }));
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('missing tx tenant → 404', async () => {
    txRepo.getTx.mockResolvedValue(null);
    await expect(svc.handover('tx1', { waive: false }, 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('check unknown code → 400 item_code', async () => {
    await expect(
      svc.upsertCheck('tx1', { item_code: 'wifi', status: 'pass' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'item_code' } });
  });

  it('broker board → 404', async () => {
    tenants.getMe.mockResolvedValue({ mode: 'broker' });
    await expect(svc.listBoard('t1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('UC-042 defect before handover → 400 not_handed_over', async () => {
    await expect(
      svc.createTicket('tx1', { kind: 'defect', title: 'Rò nước' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'not_handed_over' } });
  });

  it('UC-042 defect after handover → insert kind defect', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over' }));
    asRepo.insertTicket.mockResolvedValue({ id: 'd1', kind: 'defect', title: 'Rò nước' });
    const out = await svc.createTicket('tx1', { kind: 'defect', title: 'Rò nước' }, 't1');
    expect(out.kind).toBe('defect');
    expect(asRepo.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'defect', transaction_id: 'tx1' }),
    );
  });

  it('kind invalid → 400 kind', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over' }));
    await expect(
      svc.createTicket('tx1', { kind: 'jira', title: 'abc' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'kind' } });
  });

  it('UC-043 title skip → 400 title_status', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over', title_status: 'not_started' }));
    await expect(svc.setTitle('tx1', 'issued', 't1')).rejects.toMatchObject({
      response: { error: 'title_status' },
    });
  });

  it('UC-043 issued from handed_over + submitted → title_issued', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'handed_over', title_status: 'submitted' }));
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'title_issued', title_status: 'issued' }));
    const out = await svc.setTitle('tx1', 'issued', 't1');
    expect(out.stage).toBe('title_issued');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'title_issued',
      expect.objectContaining({ title_status: 'issued', title_issued_at: expect.any(Date) }),
      'handed_over',
    );
  });

  it('submitted keeps contracted stage', async () => {
    txRepo.getTx.mockResolvedValue(tx({ stage: 'contracted', title_status: 'not_started' }));
    txRepo.setStageIf.mockResolvedValue(tx({ stage: 'contracted', title_status: 'submitted' }));
    const out = await svc.setTitle('tx1', 'submitted', 't1');
    expect(out.title_status).toBe('submitted');
    expect(txRepo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'contracted',
      expect.objectContaining({ title_status: 'submitted' }),
      'contracted',
    );
  });

  it('AF-01 ensureIntake seeds 4 checks once', async () => {
    asRepo.listChecks.mockResolvedValue([]);
    await svc.ensureIntake(tx({ stage: 'contracted' }) as never);
    expect(asRepo.seedChecksIfEmpty).toHaveBeenCalledWith('tx1', 't1');
    await svc.ensureIntake(tx({ stage: 'contracted' }) as never);
    expect(asRepo.seedChecksIfEmpty).toHaveBeenCalledTimes(2);
  });

  it('ensureIntake no-op when not contracted', async () => {
    await svc.ensureIntake(tx({ stage: 'deposit' }) as never);
    expect(asRepo.seedChecksIfEmpty).not.toHaveBeenCalled();
  });
});
