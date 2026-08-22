import { BdsAgencyService } from './bds-agency.service';

function makeMocks() {
  const repo = {
    ensureTiers: jest.fn().mockResolvedValue([
      { id: 'tr', code: 'trial', exclusive_allowed: false, max_concurrent_holds: 3 },
    ]),
    getTierByCode: jest.fn(),
    getTier: jest.fn(),
    insertAgency: jest.fn(),
    getAgency: jest.fn(),
    listAgencies: jest.fn(),
    setAgencyStatusIf: jest.fn(),
    setAgencyTier: jest.fn(),
    insertContract: jest.fn(),
    getActiveContract: jest.fn(),
    getOrCreateRule: jest.fn(),
    grantUnit: jest.fn(),
    getOpenUnit: jest.fn(),
    listOpenUnits: jest.fn(),
    revokeUnit: jest.fn(),
    countOpenHolds: jest.fn(),
    getProjectOnePrice: jest.fn().mockResolvedValue(true),
    getUnitPool: jest.fn(),
    resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
  };
  const inventory = {
    listUnits: jest.fn().mockResolvedValue({ units: [] }),
    getOrThrow: jest.fn(),
  };
  const policies = { get: jest.fn() };
  return { repo, inventory, policies };
}

describe('BdsAgencyService', () => {
  it('create f2 without parent → 400 parent_agency_id', async () => {
    const { repo, inventory, policies } = makeMocks();
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(svc.create({ code: 'F2-1', kind: 'f2' }, 't1')).rejects.toMatchObject({
      response: { error: 'parent_agency_id' },
    });
  });

  it('activate cdt_channel → active + trial', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({ id: 'a1', status: 'prospect', tenant_id: 't1' });
    repo.getTierByCode.mockResolvedValue({ id: 'tr', code: 'trial' });
    repo.setAgencyStatusIf.mockResolvedValue({ id: 'a1', status: 'active', tier_id: 'tr' });
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    const out = await svc.activate('a1', 'cdt_channel', 't1');
    expect(out.status).toBe('active');
  });

  it('BDS-25 override without long reason → 400', async () => {
    const { repo, inventory, policies } = makeMocks();
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(
      svc.overrideTier(
        'a1',
        { tier_code: 'gold', actor_role: 'cdt_sales_dir', reason: 'ngan' },
        't1',
      ),
    ).rejects.toMatchObject({ response: { error: 'reason' } });
  });

  it('BDS-22 bronze grant exclusive → 400 exclusive_tier', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({
      id: 'a1',
      status: 'active',
      tenant_id: 't1',
      tier_id: 'br',
    });
    repo.getActiveContract.mockResolvedValue({ id: 'c1', status: 'active' });
    repo.getTier.mockResolvedValue({ id: 'br', code: 'bronze', exclusive_allowed: false });
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(
      svc.grantUnits(
        'a1',
        { project_id: 1, product_ids: [9], exclusivity: 'exclusive', actor_role: 'cdt_sales_dir' },
        't1',
      ),
    ).rejects.toMatchObject({ response: { error: 'exclusive_tier' } });
  });

  it('BDS-26 second exclusive same unit → 400 exclusive', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({
      id: 'a2',
      status: 'active',
      tenant_id: 't1',
      tier_id: 'g',
    });
    repo.getActiveContract.mockResolvedValue({ id: 'c1' });
    repo.getTier.mockResolvedValue({ exclusive_allowed: true });
    repo.getOrCreateRule.mockResolvedValue({ id: 'r1' });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      project_id: 1,
      pool: 'channel',
      status: 'available',
    });
    repo.grantUnit.mockRejectedValue({ code: '23505' });
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(
      svc.grantUnits(
        'a2',
        { project_id: 1, product_ids: [9], exclusivity: 'exclusive', actor_role: 'cdt_sales_dir' },
        't1',
      ),
    ).rejects.toMatchObject({ response: { error: 'exclusive' } });
  });

  it('revoke in-flight hold → 400 unit_in_flight', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1', status: 'active' });
    repo.getOpenUnit.mockResolvedValue({ id: 'bu1', product_id: 9 });
    inventory.getOrThrow.mockResolvedValue({
      id: 9,
      status: 'hold',
      hold_id: 'h1',
      pool: 'channel',
    });
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(svc.revokeUnit('a1', 9, 'manual', 't1')).rejects.toMatchObject({
      response: { error: 'unit_in_flight' },
    });
  });

  it('BDS-28 assertCanHold suspended → 409 agency_suspended', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({ id: 'a1', status: 'suspended', tenant_id: 't1' });
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(svc.assertCanHold('a1', 9, 't1')).rejects.toMatchObject({
      response: { error: 'agency_suspended' },
    });
  });

  it('BDS-04 assertCanHold not in basket → 404', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({
      id: 'a1',
      status: 'active',
      tenant_id: 't1',
      kind: 'f1',
      tier_id: 'tr',
    });
    inventory.getOrThrow.mockResolvedValue({ id: 9, project_id: 1, pool: 'channel' });
    repo.getActiveContract.mockResolvedValue({ id: 'c1', max_concurrent_holds: null });
    repo.getOpenUnit.mockResolvedValue(null);
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(svc.assertCanHold('a1', 9, 't1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('BDS-23 assertCanHold at quota → 409 hold_quota', async () => {
    const { repo, inventory, policies } = makeMocks();
    repo.getAgency.mockResolvedValue({
      id: 'a1',
      status: 'active',
      tenant_id: 't1',
      kind: 'f1',
      tier_id: 'tr',
    });
    inventory.getOrThrow.mockResolvedValue({ id: 9, project_id: 1, pool: 'channel' });
    repo.getActiveContract.mockResolvedValue({ id: 'c1', max_concurrent_holds: 3 });
    repo.getOpenUnit.mockResolvedValue({ id: 'bu1', product_id: 9 });
    repo.getTier.mockResolvedValue({ max_concurrent_holds: 3 });
    repo.countOpenHolds.mockResolvedValue(3);
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(svc.assertCanHold('a1', 9, 't1')).rejects.toMatchObject({
      response: { error: 'hold_quota' },
    });
  });

  it('BDS-33 agency quote net mismatch → 400 one_price', async () => {
    const { repo, inventory, policies } = makeMocks();
    policies.get.mockResolvedValue({ id: 'pol', project_id: 1, discount_cap_pct: 5 });
    repo.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1', status: 'active' });
    repo.getProjectOnePrice.mockResolvedValue(true);
    const svc = new BdsAgencyService(repo as never, inventory as never, policies as never);
    await expect(
      svc.quote(
        'a1',
        { policy_id: 'pol', list_price_vnd: 1000, discount_pct: 0, net_price_vnd: 900 },
        't1',
      ),
    ).rejects.toMatchObject({ response: { error: 'one_price' } });
  });
});
