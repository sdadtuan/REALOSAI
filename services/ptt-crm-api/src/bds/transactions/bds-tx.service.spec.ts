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
  };
  return { holds, inventory, products, policies, repo };
}

describe('BdsTxService', () => {
  it('BDS-11 deposit under min → 400 deposit_min', async () => {
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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

  it('pending hold → 409 hold_closed', async () => {
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    );
    await svc.contract('tx1', { contract_no: 'HD-1', row_version: 5 }, 't1');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'contract', 5, 't1');
  });

  it('BDS-14 cancel deposit → TX cancelled + unit available + clear pointers', async () => {
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    const { holds, inventory, products, policies, repo } = makeMocks();
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
    );
    await expect(svc.cancel('tx1', 'nope', 't1')).rejects.toMatchObject({
      response: { error: 'tx_closed' },
    });
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('reason too short → 400', async () => {
    const { holds, inventory, products, policies, repo } = makeMocks();
    const svc = new BdsTxService(
      repo as never,
      holds as never,
      inventory as never,
      products as never,
      policies as never,
    );
    await expect(svc.cancel('tx1', 'ab', 't1')).rejects.toMatchObject({
      response: { error: 'reason' },
    });
  });
});
