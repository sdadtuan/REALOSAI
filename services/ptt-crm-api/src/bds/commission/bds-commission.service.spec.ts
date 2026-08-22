import { BdsCommissionService } from './bds-commission.service';

function makeMocks() {
  const repo = {
    insertScheme: jest.fn(),
    getScheme: jest.fn(),
    getActiveScheme: jest.fn(),
    listSchemeTiers: jest.fn(),
    replaceSchemeTiers: jest.fn(),
    replaceSplits: jest.fn(),
    listSplits: jest.fn(),
    activateScheme: jest.fn(),
    insertLedger: jest.fn(),
    listLedgerByAgencyPeriod: jest.fn(),
    clawbackOpenLines: jest.fn(),
    upsertStatement: jest.fn(),
    getStatement: jest.fn(),
    setStatementStatusIf: jest.fn(),
    markAccruedPaidForPeriod: jest.fn(),
    insertAdvance: jest.fn(),
    sumAdvances: jest.fn(),
    getStatementByAgencyPeriod: jest.fn(),
  };
  const agencies = {
    getAgency: jest.fn(),
    getTier: jest.fn(),
    listTiers: jest.fn(),
    maxAdvanceCapVnd: jest.fn(),
  };
  return { repo, agencies };
}

describe('BdsCommissionService', () => {
  const prevCommission = process.env.PTT_BDS_COMMISSION;

  afterEach(() => {
    if (prevCommission === undefined) delete process.env.PTT_BDS_COMMISSION;
    else process.env.PTT_BDS_COMMISSION = prevCommission;
  });

  it('activate second scheme same project → 409 scheme_active', async () => {
    const { repo, agencies } = makeMocks();
    repo.getScheme.mockResolvedValue({ id: 's2', project_id: 12, tenant_id: 't1', status: 'draft' });
    repo.getActiveScheme.mockResolvedValue({ id: 's1', status: 'active' });
    const svc = new BdsCommissionService(repo as never, agencies as never);
    await expect(svc.activate('s2', 't1')).rejects.toMatchObject({
      response: { error: 'scheme_active' },
    });
  });

  it('BDS-13 contracted accrues ledger for agency', async () => {
    process.env.PTT_BDS_COMMISSION = '1';
    const { repo, agencies } = makeMocks();
    repo.getActiveScheme.mockResolvedValue({ id: 's1', base: 'net' });
    repo.listSplits.mockResolvedValue([{ trigger_stage: 'contracted', pct: 80 }]);
    repo.listSchemeTiers.mockResolvedValue([{ id: 'st1', min_tier_id: 'td-bronze', pct: 2 }]);
    agencies.getAgency.mockResolvedValue({ id: 'a1', tier_id: 'td-bronze', tenant_id: 't1' });
    agencies.getTier.mockResolvedValue({ id: 'td-bronze', min_score: 20 });
    agencies.listTiers.mockResolvedValue([{ id: 'td-bronze', min_score: 20 }]);
    repo.insertLedger.mockResolvedValue({});
    const svc = new BdsCommissionService(repo as never, agencies as never);
    await svc.onTxStage(
      {
        id: 'tx1',
        channel_partner_id: 'a1',
        project_id: 12,
        net_price_vnd: 1_000_000_000,
        list_price_vnd: 1_000_000_000,
        tenant_id: 't1',
      } as never,
      'contracted',
    );
    expect(repo.insertLedger).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_stage: 'contracted', status: 'accrued' }),
    );
  });

  it('inhouse empty partner skips accrue', async () => {
    process.env.PTT_BDS_COMMISSION = '1';
    const { repo, agencies } = makeMocks();
    const svc = new BdsCommissionService(repo as never, agencies as never);
    await svc.onTxStage({ id: 'tx1', channel_partner_id: '', net_price_vnd: 1 } as never, 'contracted');
    expect(repo.insertLedger).not.toHaveBeenCalled();
  });

  it('BDS-27 lock statement net matches ledger', async () => {
    const { repo, agencies } = makeMocks();
    agencies.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1' });
    repo.listLedgerByAgencyPeriod.mockResolvedValue([
      { status: 'accrued', amount_vnd: 1000 },
      { status: 'clawback', amount_vnd: 100 },
    ]);
    repo.sumAdvances.mockResolvedValue(200);
    repo.upsertStatement.mockImplementation(async (row) => row);
    const svc = new BdsCommissionService(repo as never, agencies as never);
    const out = await svc.lockStatement('a1', '2026-08-01', 't1');
    expect(out.gross_vnd).toBe(1000);
    expect(out.clawback_vnd).toBe(100);
    expect(out.advance_vnd).toBe(200);
    expect(out.net_vnd).toBe(700);
    expect(out.status).toBe('locked');
  });

  it('advance over cap → 400 advance_cap', async () => {
    const { repo, agencies } = makeMocks();
    agencies.getAgency.mockResolvedValue({ id: 'a1', tenant_id: 't1' });
    repo.getStatementByAgencyPeriod.mockResolvedValue(null);
    agencies.maxAdvanceCapVnd.mockResolvedValue(100);
    repo.sumAdvances.mockResolvedValue(50);
    const svc = new BdsCommissionService(repo as never, agencies as never);
    await expect(
      svc.createAdvance(
        { agency_id: 'a1', amount_vnd: 100, period_month: '2026-08-01' },
        't1',
      ),
    ).rejects.toMatchObject({ response: { error: 'advance_cap' } });
  });
});
