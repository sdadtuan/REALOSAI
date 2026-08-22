import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';
import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import {
  buildKpiContextFromDashboard,
  filterOptimizeRecommendations,
  type MktAiOptimizeContextInput,
} from './marketing-ai-optimize.util';
import { buildWeeklyOptimizationMemo } from './marketing-ai-weekly-memo.util';
import type {
  MktAiBrief,
  MktAiCampaignDraft,
  MktAiKpiClosedLoopPayload,
  MktAiOptimizeBody,
  MktAiOptimizeRecommendation,
  MktAiOptimizeResult,
  MktAiWeeklyMemoPayload,
} from './marketing-ai-planner.types';

const MAX_TASKS_PER_RUN = 5;

@Injectable()
export class MarketingAiOptimizeService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly dashboard: MarketingAiDashboardService,
    private readonly orchestrator: MarketingAiOrchestratorService,
    private readonly repo: MarketingAiPlannerRepository,
  ) {}

  private assertEnabled(serviceSlug?: string): void {
    if (!this.config.mktAiPlannerEnabled) {
      throw new NotFoundException({ error: 'mkt_ai_planner_disabled' });
    }
    const slugs = this.config.mktAiPlannerSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new NotFoundException({ error: 'mkt_ai_planner_slug_not_pilot', service_slug: serviceSlug });
    }
  }

  async execute(
    lifecycleId: number,
    body: MktAiOptimizeBody,
  ): Promise<Omit<MktAiOptimizeResult, 'job_id' | 'status'>> {
    const lc = await this.lifecycle.detail(lifecycleId);
    const stage = String((lc as Record<string, unknown>).stage ?? '');
    const serviceSlug = String((lc as Record<string, unknown>).service_slug ?? '');
    this.assertEnabled(serviceSlug);

    const channel = body.channel ?? 'meta';
    const dashboard = await this.dashboard.getDashboard(lifecycleId, { weeks: 6, channel });
    const briefRow = await this.repo.getBrief(lifecycleId);
    const brief = (briefRow?.brief_json ?? null) as MktAiBrief | null;
    const draft = await this.repo.ensureDraft(lifecycleId, 'optimize-copilot');
    const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];

    const ctxInput: MktAiOptimizeContextInput = {
      dashboard,
      brief,
      campaigns,
      lifecycleStage: stage,
    };

    let recommendations = await this.orchestrator.generateOptimizeRecommendations(ctxInput);
    recommendations = filterOptimizeRecommendations(recommendations, body.dismissed_recommendation_ids);

    const kpi_context = buildKpiContextFromDashboard(dashboard);
    const tasks_created: MktAiOptimizeResult['tasks_created'] = [];

    if (body.confirm_create_tasks) {
      const selected = this.selectRecommendations(recommendations, body.recommendation_ids);
      for (const rec of selected.slice(0, MAX_TASKS_PER_RUN)) {
        const { task } = await this.lifecycle.createCustomTask(lifecycleId, {
          stage: rec.suggested_task.stage,
          title: rec.suggested_task.title,
          description: rec.suggested_task.description,
        });
        tasks_created.push({
          task_id: Number(task.id),
          title: rec.suggested_task.title,
          recommendation_id: rec.id,
        });
      }
    }

    return {
      ok: true,
      kpi_context,
      recommendations,
      ...(tasks_created.length ? { tasks_created } : {}),
    };
  }

  private selectRecommendations(
    recs: MktAiOptimizeRecommendation[],
    ids: string[] | undefined,
  ): MktAiOptimizeRecommendation[] {
    if (!ids?.length) return recs;
    const wanted = new Set(ids.map((id) => id.trim()).filter(Boolean));
    return recs.filter((r) => wanted.has(r.id));
  }

  /** WS-P4-09 — weekly optimization memo template (no TMMT auto-apply). */
  buildWeeklyMemoTemplate(input: {
    brandLabel: string;
    weekLabel: string;
    closedLoop: MktAiKpiClosedLoopPayload;
    recommendations: MktAiOptimizeRecommendation[];
  }): MktAiWeeklyMemoPayload {
    return buildWeeklyOptimizationMemo(input);
  }
}
