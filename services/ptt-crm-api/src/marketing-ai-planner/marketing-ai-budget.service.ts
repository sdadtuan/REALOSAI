import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  applyScenarioToCampaigns,
  buildBudgetScenarios,
  type MktAiBudgetChannelMix,
} from './marketing-ai-budget.util';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type { MktAiBrief, MktAiBudgetScenarioRow, MktAiCampaignDraft } from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiBudgetService {
  constructor(private readonly repo: MarketingAiPlannerRepository) {}

  async simulate(
    lifecycleId: number,
    brief: MktAiBrief,
    jobId: number | null,
    count = 3,
  ): Promise<MktAiBudgetScenarioRow[]> {
    const budget = Number(brief.budget_monthly_vnd ?? 0);
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new BadRequestException({ error: 'brief_budget_required' });
    }

    const drafts = buildBudgetScenarios(brief, count);
    if (drafts.length < 2) {
      throw new BadRequestException({ error: 'budget_scenarios_empty' });
    }

    return this.repo.replaceBudgetScenarios(lifecycleId, jobId, drafts);
  }

  async applyScenario(
    lifecycleId: number,
    scenarioId: number,
    campaigns: MktAiCampaignDraft[],
    actorEmail: string,
  ): Promise<{ scenario: MktAiBudgetScenarioRow; campaigns: MktAiCampaignDraft[] }> {
    const scenario = await this.repo.getBudgetScenario(lifecycleId, scenarioId);
    if (!scenario) {
      throw new NotFoundException({ error: 'budget_scenario_not_found', scenario_id: scenarioId });
    }
    if (!campaigns.length) {
      throw new BadRequestException({
        error: 'campaigns_required',
        message: 'Sinh hoặc thêm campaign trước khi áp dụng scenario.',
      });
    }

    const mix = scenario.channel_mix_json as unknown as MktAiBudgetChannelMix;
    const updated = applyScenarioToCampaigns(campaigns, mix);
    await this.repo.selectBudgetScenario(lifecycleId, scenarioId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    await this.repo.upsertDraft(lifecycleId, { ...draft, campaigns_json: updated }, actorEmail);
    await this.repo.replaceCampaigns(lifecycleId, scenario.job_id, updated);

    const selected = (await this.repo.getBudgetScenario(lifecycleId, scenarioId)) ?? {
      ...scenario,
      is_selected: true,
    };
    return { scenario: selected, campaigns: updated };
  }
}
