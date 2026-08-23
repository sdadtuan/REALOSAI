import { BdsTxService } from './bds-tx.service';

function makeMocks() {
  const holds = {
    getHold: jest.fn(),
    setHoldStatusIf: jest.fn(),
  };
  const inventory = {
    getOrThrow: jest.fn(),
    transition: jest.fn().mockResolvedValue({ id: 9, status: 'booked', row_version: 2 }),
    listUnits: jest.fn().mockResolvedValue([]),
  };
  const products = {
    setHoldPointers: jest.fn(),
    resolveProjectTenantId: jest.fn(),
  };
  const policies = { get: jest.fn() };
  const collection = {
    ensureScheduleForTx: jest.fn().mockResolvedValue(undefined),
    assertCanContract: jest.fn().mockResolvedValue(undefined),
    assertVbttPaidPct: jest.fn().mockResolvedValue(undefined),
  };
  const repo = {
    insertTx: jest.fn(),
    setStageIf: jest.fn(),
    getTx: jest.fn(),
    getOpenByProduct: jest.fn().mockResolvedValue(null),
    getIdempotency: jest.fn(),
    putIdempotency: jest.fn(),
    getProjectOnePrice: jest.fn().mockResolvedValue(true),
    resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
    listByProject: jest.fn(),
    listReservationByProject: jest.fn(),
  };
  return { holds, inventory, products, policies, repo, collection };
}

describe('BdsTxService', () => {
  const prevCollection = process.env.PTT_BDS_COLLECTION;
  const prevChat = process.env.PTT_STAFF_CHAT;
  const prevTickets = process.env.PTT_STAFF_TICKETS;
  afterEach(() => {
    if (prevCollection === undefined) delete process.env.PTT_BDS_COLLECTION;
    else process.env.PTT_BDS_COLLECTION = prevCollection;
    if (prevChat === undefined) delete process.env.PTT_STAFF_CHAT;
    else process.env.PTT_STAFF_CHAT = prevChat;
    if (prevTickets === undefined) delete process.env.PTT_STAFF_TICKETS;
    else process.env.PTT_STAFF_TICKETS = prevTickets;
  });

  it('BDS-11 deposit under min → 400 deposit_min', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    holds.getHold.mockResolvedValue({
      id: 'h1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      status: 'active',
      tenant_id: 't1',
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      status: 'hold',
      row_version: 1,
      list_price_vnd: 1000,
      tenant_id: 't1',
    });
    policies.get.mockResolvedValue({
      id: 'pol',
      project_id: 1,
      deposit_min_vnd: 100,
      discount_cap_pct: 5,
    });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(
      svc.convertDeposit(
        'h1',
        { deposit_vnd: 50, policy_id: 'pol', row_version: 1 },
        { tenantId: 't1' },
      ),
    ).rejects.toMatchObject({ response: { error: 'deposit_min' } });
    expect(repo.insertTx).not.toHaveBeenCalled();
  });

  it('convert active hold → deposit TX + unit booked + hold converted', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    holds.getHold.mockResolvedValue({
      id: 'h1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      status: 'active',
      tenant_id: 't1',
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      status: 'hold',
      row_version: 3,
      list_price_vnd: 1000,
      tenant_id: 't1',
    });
    policies.get.mockResolvedValue({
      id: 'pol',
      project_id: 1,
      deposit_min_vnd: 100,
      discount_cap_pct: 5,
    });
    repo.insertTx.mockImplementation(async (row) => ({ id: 'tx1', ...row }));
    holds.setHoldStatusIf.mockResolvedValue({ id: 'h1', status: 'converted' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    const out = await svc.convertDeposit(
      'h1',
      { deposit_vnd: 200, policy_id: 'pol', row_version: 3, discount_pct: 0 },
      { tenantId: 't1' },
    );
    expect(out.stage).toBe('deposit');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'deposit', 3, 't1');
    expect(holds.setHoldStatusIf).toHaveBeenCalledWith('h1', 'converted', {}, 'active');
  });

  it('BDS-48 creates collection_schedule ticket on deposit when TICKETS on', async () => {
    process.env.PTT_STAFF_TICKETS = '1';
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    const tickets = { createHandoffTicket: jest.fn().mockResolvedValue({ id: 'tk1' }) };
    holds.getHold.mockResolvedValue({
      id: 'h1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      status: 'active',
      tenant_id: 't1',
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      status: 'hold',
      row_version: 3,
      list_price_vnd: 1000,
      tenant_id: 't1',
    });
    policies.get.mockResolvedValue({
      id: 'pol',
      project_id: 1,
      deposit_min_vnd: 100,
      discount_cap_pct: 5,
    });
    repo.insertTx.mockImplementation(async (row) => ({ id: 'tx1', ...row }));
    holds.setHoldStatusIf.mockResolvedValue({ id: 'h1', status: 'converted' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
      undefined,
      undefined,
      undefined,
      tickets as never,
    );
    await svc.convertDeposit(
      'h1',
      { deposit_vnd: 200, policy_id: 'pol', row_version: 3, discount_pct: 0 },
      { tenantId: 't1' },
    );
    expect(tickets.createHandoffTicket).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        queue_code: 'collection_schedule',
        entity_type: 'tx',
        idempotency_key: 'tx.deposit:tx1:deposit',
      }),
    );
  });

  it('BDS-41 posts system card on deposit when CHAT on', async () => {
    process.env.PTT_STAFF_CHAT = '1';
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    const chat = { postHandoffCard: jest.fn().mockResolvedValue({ id: 'm1' }) };
    holds.getHold.mockResolvedValue({
      id: 'h1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      status: 'active',
      tenant_id: 't1',
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      status: 'hold',
      row_version: 3,
      list_price_vnd: 1000,
      tenant_id: 't1',
    });
    policies.get.mockResolvedValue({
      id: 'pol',
      project_id: 1,
      deposit_min_vnd: 100,
      discount_cap_pct: 5,
    });
    repo.insertTx.mockImplementation(async (row) => ({ id: 'tx1', ...row }));
    holds.setHoldStatusIf.mockResolvedValue({ id: 'h1', status: 'converted' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
      undefined,
      undefined,
      chat as never,
    );
    await svc.convertDeposit(
      'h1',
      { deposit_vnd: 200, policy_id: 'pol', row_version: 3, discount_pct: 0 },
      { tenantId: 't1' },
    );
    expect(chat.postHandoffCard).toHaveBeenCalledWith(
      expect.any(String),
      'x_kd_collection',
      expect.objectContaining({ entity_type: 'tx' }),
    );
  });

  it('pending hold → 409 hold_closed', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    holds.getHold.mockResolvedValue({
      id: 'h1',
      status: 'pending',
      tenant_id: 't1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      channel_partner_id: '',
    });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(
      svc.convertDeposit(
        'h1',
        { deposit_vnd: 200, policy_id: 'pol', row_version: 1 },
        { tenantId: 't1' },
      ),
    ).rejects.toMatchObject({ response: { error: 'hold_closed' } });
  });

  it('reservation active hold → reserved unit + TX reservation', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    holds.getHold.mockResolvedValue({
      id: 'h1',
      product_id: 9,
      project_id: 1,
      lead_id: 7,
      status: 'active',
      tenant_id: 't1',
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      status: 'hold',
      row_version: 2,
      list_price_vnd: 1000,
      tenant_id: 't1',
    });
    repo.insertTx.mockImplementation(async (row) => ({ id: 'tx1', stage: 'reservation', ...row }));
    holds.setHoldStatusIf.mockResolvedValue({ id: 'h1', status: 'converted' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    const out = await svc.reservation(
      'h1',
      { reservation_fee_vnd: 50_000_000, row_version: 2 },
      { tenantId: 't1' },
    );
    expect(out.stage).toBe('reservation');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'reservation_fee', 2, 't1');
    expect(holds.setHoldStatusIf).toHaveBeenCalledWith('h1', 'converted', {}, 'active');
  });

  it('convert after reservation advances same TX to deposit', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getOpenByProduct.mockResolvedValue({
      id: 'tx1',
      stage: 'reservation',
      hold_id: 'h1',
      product_id: 9,
      project_id: 1,
    });
    holds.getHold.mockResolvedValue({
      id: 'h1',
      status: 'converted',
      product_id: 9,
      project_id: 1,
      tenant_id: 't1',
      lead_id: 7,
      channel_partner_id: '',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'reserved',
      row_version: 4,
      list_price_vnd: 1000,
      project_id: 1,
      tenant_id: 't1',
    });
    policies.get.mockResolvedValue({
      id: 'pol',
      project_id: 1,
      deposit_min_vnd: 100,
      discount_cap_pct: 5,
    });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'deposit' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await svc.convertDeposit(
      'h1',
      { deposit_vnd: 200, policy_id: 'pol', row_version: 4 },
      { tenantId: 't1' },
    );
    expect(repo.insertTx).not.toHaveBeenCalled();
    expect(repo.setStageIf).toHaveBeenCalledWith('tx1', 'deposit', expect.anything(), 'reservation');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'deposit', 4, 't1');
  });

  it('vbtt from deposit ok; from contracted → 409 tx_stage', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'vbtt' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    const out = await svc.vbtt('tx1', { vbtt_no: 'VB-1' }, 't1');
    expect(out.stage).toBe('vbtt');

    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'contracted',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    await expect(svc.vbtt('tx1', { vbtt_no: 'VB-2' }, 't1')).rejects.toMatchObject({
      response: { error: 'tx_stage' },
    });
  });

  it('contract from deposit → sold + contracted (no paid_pct check)', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'booked',
      row_version: 5,
      tenant_id: 't1',
    });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'contracted', tenant_id: 't1' });
    const aftersales = { ensureIntake: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
      undefined,
      undefined,
      undefined,
      undefined,
      aftersales as never,
    );
    await svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'contract', 5, 't1');
    expect(collection.assertCanContract).not.toHaveBeenCalled();
    expect(aftersales.ensureIntake).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx1', stage: 'contracted' }),
    );
  });

  it('BDS-31 COLLECTION=1 contract without so_xd → 400 legal_gate_hdmb', async () => {
    process.env.PTT_BDS_COLLECTION = '1';
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
      paid_pct: 50,
      policy_id: 'p1',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'booked',
      row_version: 5,
      tenant_id: 't1',
    });
    const { BadRequestException } = await import('@nestjs/common');
    collection.assertCanContract.mockRejectedValue(
      new BadRequestException({ error: 'legal_gate_hdmb' }),
    );
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(
      svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'legal_gate_hdmb' } });
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('BDS-32 COLLECTION=1 contract paid_pct low → 400 paid_pct', async () => {
    process.env.PTT_BDS_COLLECTION = '1';
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
      paid_pct: 10,
      policy_id: 'p1',
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'booked',
      row_version: 5,
      tenant_id: 't1',
    });
    const { BadRequestException } = await import('@nestjs/common');
    collection.assertCanContract.mockRejectedValue(
      new BadRequestException({ error: 'paid_pct' }),
    );
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(
      svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'paid_pct' } });
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('COLLECTION=0 contract skips gate (P4)', async () => {
    process.env.PTT_BDS_COLLECTION = '0';
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'booked',
      row_version: 5,
      tenant_id: 't1',
    });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'contracted' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1');
    expect(collection.assertCanContract).not.toHaveBeenCalled();
  });

  it('BDS-14 cancel deposit → TX cancelled + unit available + clear pointers', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'deposit',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'booked',
      row_version: 6,
      tenant_id: 't1',
    });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'cancelled' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await svc.cancel('tx1', 'khach bo', 't1');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'cancel', 6, 't1');
    expect(products.setHoldPointers).toHaveBeenCalledWith(9, {
      hold_id: null,
      hold_lead_id: null,
      hold_at: '',
    });
    expect(inventory.transition.mock.invocationCallOrder[0]).toBeLessThan(
      repo.setStageIf.mock.invocationCallOrder[0],
    );
  });

  it('cancel contracted → 409 tx_closed, no transition', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.getTx.mockResolvedValue({
      id: 'tx1',
      stage: 'contracted',
      product_id: 9,
      tenant_id: 't1',
      project_id: 1,
    });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(svc.cancel('tx1', 'nope', 't1')).rejects.toMatchObject({
      response: { error: 'tx_closed' },
    });
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('reason too short → 400', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    await expect(svc.cancel('tx1', 'ab', 't1')).rejects.toMatchObject({
      response: { error: 'reason' },
    });
  });

  it('BDS-37 cancel reservation TXs on project', async () => {
    const { holds, inventory, products, policies, repo, collection } = makeMocks();
    repo.listReservationByProject.mockResolvedValue([
      { id: 'tx1', stage: 'reservation', product_id: 9, tenant_id: 't1' },
    ]);
    inventory.getOrThrow.mockResolvedValue({ product_id: 9, status: 'reserved', row_version: 2 });
    repo.setStageIf.mockResolvedValue({ id: 'tx1', stage: 'cancelled' });
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
      collection as never,
    );
    const n = await svc.cancelLaunchReservations(7, 't1');
    expect(n).toBe(1);
    expect(repo.setStageIf).toHaveBeenCalledWith(
      'tx1',
      'cancelled',
      expect.objectContaining({ lost_reason: 'launch_window' }),
      'reservation',
    );
    expect(inventory.transition).toHaveBeenCalledWith(9, 'cancel', 2, 't1');
  });
});
