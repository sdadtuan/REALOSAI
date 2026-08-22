import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { computeQualityScore } from './marketing-ai-quality.util';
import { validateMktAiBrief } from './marketing-ai-brief.util';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type { MktAiBrief, MktAiDraft } from './marketing-ai-planner.types';
import {
  buildCampaignPlaybookBlock,
  buildStrategyPlaybookBlock,
  evaluateLaunchQaQualityGate,
  listPlaybookCatalog,
  matchPlaybookForServiceSlug,
  mergeBriefWithPlaybook,
  readPlaybookFile,
  resolveActivePlaybookSlug,
  discoverPlaybookJsonSlugs,
  validateMktAiPlaybookDocument,
  MKT_AI_PLAYBOOK_SLUGS,
  type MktAiIndustryPlaybook,
  type MktAiLaunchQaQualityGate,
} from './marketing-ai-playbook.util';

export interface MktAiPlaybookListItem {
  slug: string;
  label_vi: string;
  quality_gate: { min_score_launch_qa: number };
}

export interface MktAiPlaybookListResult {
  ok: boolean;
  service_slug: string;
  active_slug: string | null;
  playbooks: MktAiPlaybookListItem[];
}

export interface MktAiAdminPlaybookRow {
  slug: string;
  label_vi: string;
  service_slugs: string[];
  file: string;
  quality_gate: { min_score_launch_qa: number; require_campaign_count: number };
  strategy_hint_count: number;
  campaign_kpi_template_count: number;
  governance_notes_count: number;
  has_channel_mix: boolean;
  has_stub_swot: boolean;
  in_runtime_catalog: boolean;
  schema_valid: boolean;
  schema_errors: string[];
}

export interface MktAiAdminPlaybookListResult {
  ok: boolean;
  feature_enabled: boolean;
  runtime_catalog_slugs: string[];
  count: number;
  playbooks: MktAiAdminPlaybookRow[];
}

export interface MktAiPlaybookContext {
  slug: string | null;
  label_vi: string | null;
  quality_gate: { min_score_launch_qa: number; met: boolean };
  governance_notes: string[];
}

@Injectable()
export class MarketingAiPlaybookService {
  private catalogCache: MktAiIndustryPlaybook[] | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
  ) {}

  isEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiPlaybooksEnabled;
  }

  isGovernanceBannerEnabled(): boolean {
    return this.isEnabled() && this.config.mktAiGovernanceBanner;
  }

  isLaunchQaQualityGateEnabled(): boolean {
    return this.isEnabled() && this.config.mktAiLaunchQaQualityGate;
  }

  private getCatalog(): MktAiIndustryPlaybook[] {
    if (!this.catalogCache) {
      this.catalogCache = listPlaybookCatalog();
    }
    return this.catalogCache;
  }

  getPlaybook(slug: string): MktAiIndustryPlaybook {
    try {
      return readPlaybookFile(slug);
    } catch {
      throw new NotFoundException({ error: 'mkt_ai_playbook_not_found', slug });
    }
  }

  resolvePlaybook(slug: string | null | undefined, serviceSlug: string): MktAiIndustryPlaybook | null {
    if (slug) {
      try {
        return this.getPlaybook(slug);
      } catch {
        /* fall through */
      }
    }
    return matchPlaybookForServiceSlug(serviceSlug, this.getCatalog());
  }

  listForLifecycle(serviceSlug: string, brief: MktAiBrief | null): MktAiPlaybookListResult {
    const pilotSlugs = this.config.mktAiPlannerSlugs;
    const catalog = this.getCatalog().filter(
      (p) => !pilotSlugs.length || p.service_slugs.some((s) => pilotSlugs.includes(s)),
    );
    const activeSlug = resolveActivePlaybookSlug(brief, serviceSlug, this.getCatalog());
    return {
      ok: true,
      service_slug: serviceSlug,
      active_slug: activeSlug,
      playbooks: catalog.map((p) => ({
        slug: p.slug,
        label_vi: p.label_vi,
        quality_gate: { min_score_launch_qa: p.quality_gate.min_score_launch_qa },
      })),
    };
  }

  /** WS-P4-08 — read-only admin catalog from JSON files on disk */
  listAdminCatalog(): MktAiAdminPlaybookListResult {
    const slugs = discoverPlaybookJsonSlugs();
    const runtimeSlugs = new Set<string>(MKT_AI_PLAYBOOK_SLUGS);
    const playbooks: MktAiAdminPlaybookRow[] = slugs.map((slug) => {
      const pb = readPlaybookFile(slug);
      const schema_errors = validateMktAiPlaybookDocument(pb, slug);
      return {
        slug: pb.slug,
        label_vi: pb.label_vi,
        service_slugs: pb.service_slugs,
        file: `${slug}.json`,
        quality_gate: {
          min_score_launch_qa: pb.quality_gate.min_score_launch_qa,
          require_campaign_count: pb.quality_gate.require_campaign_count,
        },
        strategy_hint_count: pb.strategy_prompt_hints?.length ?? 0,
        campaign_kpi_template_count: pb.campaign_kpi_templates?.length ?? 0,
        governance_notes_count: pb.governance_notes_vi?.length ?? 0,
        has_channel_mix: Boolean(pb.channel_mix_pct && Object.keys(pb.channel_mix_pct).length),
        has_stub_swot: Boolean(pb.stub_swot_json),
        in_runtime_catalog: runtimeSlugs.has(pb.slug),
        schema_valid: schema_errors.length === 0,
        schema_errors,
      };
    });

    return {
      ok: true,
      feature_enabled: this.isEnabled(),
      runtime_catalog_slugs: [...MKT_AI_PLAYBOOK_SLUGS],
      count: playbooks.length,
      playbooks,
    };
  }

  buildPromptHints(playbook: MktAiIndustryPlaybook | null): {
    strategyBlock?: string;
    campaignBlock?: string;
    stubSwotJson?: Record<string, unknown>;
  } {
    if (!playbook) return {};
    return {
      strategyBlock: buildStrategyPlaybookBlock(playbook.strategy_prompt_hints),
      campaignBlock: buildCampaignPlaybookBlock(playbook.campaign_kpi_templates),
      stubSwotJson: playbook.stub_swot_json,
    };
  }

  buildContextFromDraft(args: {
    brief: MktAiBrief | null;
    draft: MktAiDraft;
    serviceSlug: string;
    qualityScore: number;
  }): {
    playbook: MktAiPlaybookContext;
    launch_qa_quality_gate: MktAiLaunchQaQualityGate;
  } {
    const activeSlug = resolveActivePlaybookSlug(args.brief, args.serviceSlug, this.getCatalog());
    const playbookRow = activeSlug ? this.resolvePlaybook(activeSlug, args.serviceSlug) : null;
    const minScore = playbookRow?.quality_gate.min_score_launch_qa ?? 70;
    const launch_qa_quality_gate = evaluateLaunchQaQualityGate({
      enabled: this.isLaunchQaQualityGateEnabled(),
      minScore,
      currentScore: args.qualityScore,
    });
    return {
      playbook: {
        slug: playbookRow?.slug ?? null,
        label_vi: playbookRow?.label_vi ?? null,
        quality_gate: {
          min_score_launch_qa: minScore,
          met: args.qualityScore >= minScore,
        },
        governance_notes: playbookRow?.governance_notes_vi ?? [],
      },
      launch_qa_quality_gate,
    };
  }

  async checkLaunchQaQualityGate(lifecycleId: number, serviceSlug: string): Promise<MktAiLaunchQaQualityGate> {
    if (!this.isLaunchQaQualityGateEnabled()) {
      return evaluateLaunchQaQualityGate({
        enabled: false,
        minScore: 70,
        currentScore: null,
      });
    }

    const briefRow = await this.repo.getBrief(lifecycleId);
    const draft = (await this.repo.getDraft(lifecycleId)) ?? ({
      strategy_framework: {},
      target_market_prof: {},
      swot_json: {},
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
    });
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft);
    const activeSlug = resolveActivePlaybookSlug(
      briefRow?.brief_json ?? null,
      serviceSlug,
      this.getCatalog(),
    );
    const playbook = this.resolvePlaybook(activeSlug, serviceSlug);
    const minScore = playbook?.quality_gate.min_score_launch_qa ?? 70;
    return evaluateLaunchQaQualityGate({
      enabled: true,
      minScore,
      currentScore: quality.score,
    });
  }

  mergeAndPersistPlaybook(args: {
    lifecycleId: number;
    slug: string;
    serviceSlug: string;
    existingBrief: MktAiBrief | null;
    confirmOverwrite?: boolean;
    actorEmail: string;
    prefillSources?: string[];
  }): Promise<{
    brief: MktAiBrief;
    brief_validation: ReturnType<typeof validateMktAiBrief>;
    playbook_slug: string;
    messages: string[];
  }> {
    const playbook = this.getPlaybook(args.slug);
    const { brief, messages } = mergeBriefWithPlaybook(args.existingBrief, playbook, {
      confirmOverwrite: args.confirmOverwrite,
      serviceSlug: args.serviceSlug,
    });
    const brief_validation = validateMktAiBrief(brief);
    return this.persistPlaybookApply({
      lifecycleId: args.lifecycleId,
      brief,
      brief_validation,
      playbook_slug: playbook.slug,
      messages,
      actorEmail: args.actorEmail,
      prefillSources: args.prefillSources,
    });
  }

  private async persistPlaybookApply(args: {
    lifecycleId: number;
    brief: MktAiBrief;
    brief_validation: ReturnType<typeof validateMktAiBrief>;
    playbook_slug: string;
    messages: string[];
    actorEmail: string;
    prefillSources?: string[];
  }) {
    await this.repo.upsertBrief(
      args.lifecycleId,
      args.brief,
      [...(args.prefillSources ?? []), `playbook:${args.playbook_slug}`],
      args.actorEmail,
    );
    const draft = await this.repo.ensureDraft(args.lifecycleId, args.actorEmail);
    await this.repo.upsertDraft(
      args.lifecycleId,
      {
        ...draft,
        quality_score_json: {
          ...draft.quality_score_json,
          playbook_slug: args.playbook_slug,
        },
      },
      args.actorEmail,
    );
    return {
      brief: args.brief,
      brief_validation: args.brief_validation,
      playbook_slug: args.playbook_slug,
      messages: args.messages,
    };
  }
}
