import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiRagService } from './marketing-ai-rag.service';
import {
  applyVariantToStrategy,
  compareStrategyScenarios,
  STRATEGY_VARIANTS,
} from './marketing-ai-strategy-scenario.util';
import type {
  MktAiStrategyScenarioComparePayload,
  MktAiStrategyScenarioRow,
} from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiStrategyScenarioService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly orchestrator: MarketingAiOrchestratorService,
    private readonly rag: MarketingAiRagService,
    private readonly playbooks: MarketingAiPlaybookService,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiScenarioCompare;
  }

  async list(lifecycleId: number): Promise<MktAiStrategyScenarioRow[]> {
    return this.repo.listStrategyScenarios(lifecycleId);
  }

  async executeGenerate(
    lifecycleId: number,
    count: number,
    jobId: number,
    brief: import('./marketing-ai-planner.types').MktAiBrief,
  ): Promise<MktAiStrategyScenarioRow[]> {
    const n = Math.min(3, Math.max(2, count || 3));
    const variants = STRATEGY_VARIANTS.slice(0, n);
    const ragCtx = await this.rag.buildForStrategy(lifecycleId, brief);
    const ragCitations = ragCtx.enabled ? this.rag.attachCitations(ragCtx.chunks) : undefined;
    const playbookList = this.playbooks.isEnabled()
      ? this.playbooks.listForLifecycle(String(brief.service_slug ?? ''), brief)
      : null;

    const base = await this.orchestrator.generateStrategy(brief, {
      ragPromptBlock: ragCtx.promptBlock,
      ragCitations,
      playbookPromptBlock: playbookList?.active_slug
        ? `Playbook: ${playbookList.active_slug}`
        : undefined,
    });

    const drafts = variants.map((v, idx) => {
      const applied = applyVariantToStrategy(base, v.slug);
      return {
        label: v.label,
        variant_slug: v.slug,
        variant_index: idx,
        strategy_framework_json: applied.strategy_framework,
        target_market_prof_json: applied.target_market_prof,
        swot_json: applied.swot_json,
        channel_focus_json: applied.channel_focus_json,
        messaging_json: applied.messaging_json,
      };
    });

    return this.repo.replaceStrategyScenarios(lifecycleId, jobId, drafts);
  }

  async selectScenario(
    lifecycleId: number,
    scenarioId: number,
    actorEmail: string,
  ): Promise<{ scenario: MktAiStrategyScenarioRow; draft_updated: boolean }> {
    const scenario = await this.repo.getStrategyScenario(lifecycleId, scenarioId);
    if (!scenario) {
      throw new NotFoundException({ error: 'strategy_scenario_not_found', scenario_id: scenarioId });
    }

    await this.repo.selectStrategyScenario(lifecycleId, scenarioId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    await this.repo.upsertDraft(
      lifecycleId,
      {
        ...draft,
        strategy_framework: scenario.strategy_framework_json,
        target_market_prof: scenario.target_market_prof_json,
        swot_json: scenario.swot_json,
      },
      actorEmail,
    );

    const selected = (await this.repo.getStrategyScenario(lifecycleId, scenarioId)) ?? scenario;
    return { scenario: selected, draft_updated: true };
  }

  async compare(
    lifecycleId: number,
    scenarioAId: number,
    scenarioBId: number,
  ): Promise<MktAiStrategyScenarioComparePayload> {
    const a = await this.repo.getStrategyScenario(lifecycleId, scenarioAId);
    const b = await this.repo.getStrategyScenario(lifecycleId, scenarioBId);
    if (!a || !b) {
      throw new NotFoundException({ error: 'strategy_scenario_not_found' });
    }
    return compareStrategyScenarios(a, b);
  }
}
