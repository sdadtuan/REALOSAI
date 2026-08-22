import { BdsTenantService } from './bds-tenant.service';

describe('BdsTenantService', () => {
  it('rejects empty code', async () => {
    const repo = { insert: jest.fn(), setStatus: jest.fn() };
    const seed = { seedForTenant: jest.fn() };
    const svc = new BdsTenantService(repo as never, seed as never);
    await expect(
      svc.create({ code: '  ', name: 'X', mode: 'developer' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('inserts then seeds org', async () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      code: 'acme',
      name: 'ACME',
      mode: 'developer' as const,
      status: 'draft' as const,
      operated_by_ptt: false,
    };
    const repo = { insert: jest.fn().mockResolvedValue(row), setStatus: jest.fn() };
    const seed = { seedForTenant: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsTenantService(repo as never, seed as never);
    await svc.create({ code: 'acme', name: 'ACME', mode: 'developer' });
    expect(seed.seedForTenant).toHaveBeenCalledWith(row.id, 'developer');
  });

  it('activate without required positions returns 400 br_bds_34', async () => {
    const repo = { insert: jest.fn(), setStatus: jest.fn() };
    const seed = { seedForTenant: jest.fn() };
    const svc = new BdsTenantService(repo as never, seed as never);
    await expect(svc.activate('tid', ['gdkd'])).rejects.toMatchObject({
      response: { error: 'br_bds_34' },
    });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });
});
