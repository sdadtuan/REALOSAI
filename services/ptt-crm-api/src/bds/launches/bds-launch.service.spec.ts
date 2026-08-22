import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BdsLaunchService } from './bds-launch.service';

function launch(over: Record<string, unknown> = {}) {
  return {
    id: 'L1',
    tenant_id: 't1',
    project_id: 7,
    phase_id: 'ph1',
    hold_ttl_seconds: 180,
    price_list_id: 3,
    status: 'draft',
    ...over,
  };
}

describe('BdsLaunchService', () => {
  const repo = {
    insert: jest.fn(),
    getById: jest.fn(),
    getOpenByProject: jest.fn(),
    listByTenant: jest.fn(),
    setStatusIf: jest.fn(),
    enqueue: jest.fn(),
    peekWaiting: jest.fn(),
    setQueueStatusIf: jest.fn(),
    listWaiting: jest.fn(),
    countWaitingByProduct: jest.fn(),
    listActiveHoldsForProject: jest.fn(),
  };
  const tenants = { getMe: jest.fn().mockResolvedValue({ mode: 'developer' }) };
  const projectOs = {
    getPhase: jest.fn().mockResolvedValue({ id: 'ph1', project_id: 7, price_list_id: 3 }),
  };
  const txs = { cancelLaunchReservations: jest.fn().mockResolvedValue(1) };
  const holds = { create: jest.fn() };
  let svc: BdsLaunchService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenants.getMe.mockResolvedValue({ mode: 'developer' });
    svc = new BdsLaunchService(
      repo as never,
      tenants as never,
      projectOs as never,
      txs as never,
      holds as never,
    );
  });

  it('open draft → open + snapshot price', async () => {
    repo.getById.mockResolvedValue(launch());
    repo.getOpenByProject.mockResolvedValue(null);
    repo.setStatusIf.mockResolvedValue(launch({ status: 'open' }));
    const out = await svc.open('L1', 't1');
    expect(out.status).toBe('open');
    expect(repo.setStatusIf).toHaveBeenCalledWith(
      'L1',
      'open',
      expect.objectContaining({ opened_at: expect.any(Date), price_list_id: 3 }),
      'draft',
    );
  });

  it('open when another open on project → 409 launch_open', async () => {
    repo.getById.mockResolvedValue(launch());
    repo.getOpenByProject.mockResolvedValue(launch({ id: 'L2', status: 'open' }));
    await expect(svc.open('L1', 't1')).rejects.toMatchObject({ response: { error: 'launch_open' } });
  });

  it('open from open → 409 launch_status', async () => {
    repo.getById.mockResolvedValue(launch({ status: 'open' }));
    await expect(svc.open('L1', 't1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('close open → closed and refund reservations', async () => {
    repo.getById.mockResolvedValue(launch({ status: 'open' }));
    repo.setStatusIf.mockResolvedValue(launch({ status: 'closed' }));
    await svc.close('L1', 't1');
    expect(txs.cancelLaunchReservations).toHaveBeenCalledWith(7, 't1');
  });

  it('broker list → 404', async () => {
    tenants.getMe.mockResolvedValue({ mode: 'broker' });
    await expect(svc.list('t1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create without project_id → 400 project_id', async () => {
    await expect(svc.create({} as never, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enqueueOnConflict writes waiting row', async () => {
    repo.getOpenByProject.mockResolvedValue(launch({ status: 'open' }));
    repo.enqueue.mockResolvedValue({ id: 'q1', status: 'waiting' });
    await svc.enqueueOnConflict(7, { lead_id: 12, product_id: 9, tenant_id: 't1' });
    expect(repo.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ launch_id: 'L1', lead_id: 12 }),
    );
  });

  it('enqueueOnConflict no-op when no open launch', async () => {
    repo.getOpenByProject.mockResolvedValue(null);
    await svc.enqueueOnConflict(7, { lead_id: 12, product_id: 9 });
    expect(repo.enqueue).not.toHaveBeenCalled();
  });

  it('promoteNext creates hold for oldest waiting', async () => {
    repo.getOpenByProject.mockResolvedValue(launch({ status: 'open' }));
    repo.peekWaiting.mockResolvedValue({
      id: 'q1',
      launch_id: 'L1',
      product_id: 9,
      lead_id: 12,
      channel_partner_id: '',
      status: 'waiting',
    });
    repo.setQueueStatusIf.mockResolvedValue({ id: 'q1', status: 'promoted' });
    holds.create.mockResolvedValue({ id: 'h2' });
    await svc.promoteNext(7, 9, { tenantId: 't1', row_version: 4 });
    expect(holds.create).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ lead_id: 12, row_version: 4 }),
      expect.objectContaining({ tenantId: 't1' }),
    );
  });

  it('promoteNext no queue → 0', async () => {
    repo.getOpenByProject.mockResolvedValue(launch({ status: 'open' }));
    repo.peekWaiting.mockResolvedValue(null);
    await expect(svc.promoteNext(7, 9, { tenantId: 't1', row_version: 1 })).resolves.toBeNull();
  });
});
