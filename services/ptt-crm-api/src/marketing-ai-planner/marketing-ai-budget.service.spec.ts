import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketingAiBudgetService } from './marketing-ai-budget.service';

describe('MarketingAiBudgetService', () => {
  const repo = {
    replaceBudgetScenarios: jest.fn(),
    listBudgetScenarios: jest.fn(),
    getBudgetScenario: jest.fn(),
    selectBudgetScenario: jest.fn(),
    ensureDraft: jest.fn(),
    upsertDraft: jest.fn(),
    replaceCampaigns: jest.fn(),
  };

  let service: MarketingAiBudgetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiBudgetService(repo as never);
  });

  it('simulate rejects missing budget', async () => {
    await expect(
      service.simulate(1, { objective: 'lead' }, 10),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('simulate stores scenarios', async () => {
    repo.replaceBudgetScenarios.mockResolvedValue([
      { id: 1, slug: 'balanced', name: 'Balanced' },
    ]);
    const rows = await service.simulate(
      1,
      { objective: 'lead', budget_monthly_vnd: 50_000_000 },
      10,
    );
    expect(repo.replaceBudgetScenarios).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it('applyScenario updates campaigns', async () => {
    repo.getBudgetScenario.mockResolvedValue({
      id: 2,
      job_id: 10,
      channel_mix_json: { meta_pct: 35, google_pct: 25, content_pct: 10, reserve_pct: 30 },
    });
    repo.ensureDraft.mockResolvedValue({ campaigns_json: [] });
    repo.selectBudgetScenario.mockResolvedValue({ id: 2, is_selected: true });
    repo.getBudgetScenario.mockResolvedValueOnce({
      id: 2,
      job_id: 10,
      channel_mix_json: { meta_pct: 35, google_pct: 25, content_pct: 10, reserve_pct: 30 },
    });

    const campaigns = [
      { name: 'Meta', objective: 'lead', channel_mix: ['Meta'], budget_pct: 0 },
      { name: 'Google', objective: 'lead', channel_mix: ['Google'], budget_pct: 0 },
    ];

    const out = await service.applyScenario(1, 2, campaigns, 'u@test.vn');
    expect(out.campaigns[0].budget_pct).toBeGreaterThan(0);
    expect(repo.upsertDraft).toHaveBeenCalled();
  });

  it('applyScenario 404 when missing', async () => {
    repo.getBudgetScenario.mockResolvedValue(null);
    await expect(
      service.applyScenario(1, 99, [{ name: 'X', objective: 'lead', channel_mix: [], budget_pct: 0 }], 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
