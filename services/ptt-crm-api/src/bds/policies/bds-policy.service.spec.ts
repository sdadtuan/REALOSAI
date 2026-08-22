import { NotFoundException } from '@nestjs/common';
import { BdsPolicyService } from './bds-policy.service';

describe('BdsPolicyService', () => {
  const repo = {
    insertPolicy: jest.fn(),
    updateDraft: jest.fn(),
    getPolicy: jest.fn(),
    listByProject: jest.fn(),
    resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
    getProjectOnePrice: jest.fn().mockResolvedValue(true),
    insertPriceList: jest.fn(),
    getPriceList: jest.fn(),
    upsertPriceListItem: jest.fn(),
    listPriceLists: jest.fn(),
    setPolicyStatusIf: jest.fn(),
    archiveActiveAudience: jest.fn(),
    getPhase: jest.fn(),
    setPhaseSnapshot: jest.fn(),
    setPriceListPolicy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.resolveProjectTenantId.mockResolvedValue('t1');
    repo.getProjectOnePrice.mockResolvedValue(true);
  });

  it('create stamps tenant from project not body', async () => {
    repo.insertPolicy.mockImplementation(async (row) => ({ id: 'p1', ...row, status: 'draft' }));
    const svc = new BdsPolicyService(repo as never);
    await svc.create(9, { code: 'CSBH-1' }, 't1');
    expect(repo.insertPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 't1', project_id: 9, code: 'CSBH-1' }),
    );
  });

  it('create empty code → 400', async () => {
    const svc = new BdsPolicyService(repo as never);
    await expect(svc.create(9, { code: '  ' }, 't1')).rejects.toMatchObject({
      response: { error: 'code' },
    });
  });

  it('wrong tenant header → 404', async () => {
    const svc = new BdsPolicyService(repo as never);
    await expect(svc.create(9, { code: 'A' }, 'other')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update non-draft → 409 policy_locked', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'active',
    });
    const svc = new BdsPolicyService(repo as never);
    await expect(svc.updateDraft('p1', { name: 'x' }, 't1')).rejects.toMatchObject({
      response: { error: 'policy_locked' },
    });
  });

  it('UC-009 E1 cv_gia cannot activate', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'draft',
      audience: 'all',
    });
    const svc = new BdsPolicyService(repo as never);
    await expect(
      svc.activate('p1', { phase_id: 'ph1', price_list_id: 1, actor_role: 'cv_gia' }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'activate_forbidden' } });
  });

  it('activate snapshots phase + archives sibling', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'draft',
      audience: 'all',
    });
    repo.getPhase.mockResolvedValue({ id: 'ph1', project_id: 9 });
    repo.getPriceList.mockResolvedValue({ id: 3, project_id: 9 });
    repo.setPolicyStatusIf.mockResolvedValue({ id: 'p1', status: 'active' });
    const svc = new BdsPolicyService(repo as never);
    await svc.activate(
      'p1',
      { phase_id: 'ph1', price_list_id: 3, actor_role: 'cdt_sales_dir', activated_by: 'gdkd' },
      't1',
    );
    expect(repo.archiveActiveAudience).toHaveBeenCalledWith(9, 'all', 'p1');
    expect(repo.setPhaseSnapshot).toHaveBeenCalledWith('ph1', 'p1', 3);
    expect(repo.setPriceListPolicy).toHaveBeenCalledWith(3, 'p1');
  });

  it('BDS-12 quote over cap → 400 discount_cap', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'active',
      discount_cap_pct: 5,
      maintenance_fee_vnd: 0,
      fee_unit: 'per_unit',
    });
    const svc = new BdsPolicyService(repo as never);
    await expect(
      svc.quote('p1', { list_price_vnd: 100, discount_pct: 8 }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'discount_cap' } });
  });

  it('quote under cap returns net', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'draft',
      discount_cap_pct: 5,
      maintenance_fee_vnd: 0,
      fee_unit: 'per_unit',
    });
    const svc = new BdsPolicyService(repo as never);
    await expect(
      svc.quote('p1', { list_price_vnd: 100, discount_pct: 5 }, 't1'),
    ).resolves.toMatchObject({ net_price_vnd: 95 });
  });

  it('quote net mismatch when one_price → 400 one_price', async () => {
    repo.getPolicy.mockResolvedValue({
      id: 'p1',
      project_id: 9,
      tenant_id: 't1',
      status: 'active',
      discount_cap_pct: 10,
      maintenance_fee_vnd: 0,
      fee_unit: 'per_unit',
    });
    repo.getProjectOnePrice.mockResolvedValue(true);
    const svc = new BdsPolicyService(repo as never);
    await expect(
      svc.quote('p1', { list_price_vnd: 100, discount_pct: 10, net_price_vnd: 99 }, 't1'),
    ).rejects.toMatchObject({ response: { error: 'one_price' } });
  });
});
