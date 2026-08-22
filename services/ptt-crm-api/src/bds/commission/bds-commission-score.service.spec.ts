import { BdsCommissionScoreService } from './bds-commission-score.service';

describe('BdsCommissionScoreService', () => {
  it('BDS-24 bronze→silver after score; old ledger pct unchanged', async () => {
    const repo = {
      insertScore: jest.fn().mockResolvedValue({}),
      updatePct: jest.fn(),
    };
    const agencyRepo = {
      listAgencies: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          status: 'active',
          tier_id: 'tier-bronze',
          tier_override: false,
          tenant_id: 't1',
        },
      ]),
      listTiers: jest.fn().mockResolvedValue([
        { id: 'tier-trial', code: 'trial', min_score: 0 },
        { id: 'tier-bronze', code: 'bronze', min_score: 20 },
        { id: 'tier-silver', code: 'silver', min_score: 45 },
      ]),
      setAgencyTierFromRecalc: jest.fn().mockResolvedValue({}),
    };
    const txs = {
      sumContractedForAgencyInPeriod: jest.fn().mockResolvedValue({
        gmv: 10_000_000_000,
        units: 5,
      }),
    };
    const score = new BdsCommissionScoreService(
      repo as never,
      agencyRepo as never,
      txs as never,
    );
    await score.recalc('2026-08-01', 't1', {
      targets: [{ agencyId: 'a1', target_gmv: 1, target_units: 1 }],
    });
    expect(agencyRepo.setAgencyTierFromRecalc).toHaveBeenCalledWith('a1', 'tier-silver');
    expect(repo.updatePct).not.toHaveBeenCalled();
  });
});
