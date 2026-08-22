import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { TARGET_MARKET_PROF_KEYS } from '../service-lifecycle/lifecycle-marketing-plan.util';
import type { MktAiBrief, MktAiCampaignDraft, MktAiCitation, MktAiOptimizeRecommendation } from './marketing-ai-planner.types';
import {
  MKT_AI_PROMPT_VERSION,
  MKT_AI_CAMPAIGN_SYSTEM,
  MKT_AI_CONTENT_SYSTEM,
  MKT_AI_OPTIMIZE_SYSTEM,
  MKT_AI_STRATEGY_SYSTEM,
  STRATEGY_FRAMEWORK_KEYS,
  buildCampaignUserPrompt,
  buildContentUserPrompt,
  buildOptimizeUserPrompt,
  buildStrategyUserPrompt,
} from './marketing-ai-prompts';
import {
  normalizeCampaignsOutput,
  normalizeContentOutput,
  normalizeStrategyOutput,
  type MktAiContentOutput,
  type MktAiStrategyOutput,
} from './marketing-ai-orchestrator.util';
import {
  buildRuleBasedOptimizeRecommendations,
  normalizeOptimizeRecommendations,
  type MktAiOptimizeContextInput,
} from './marketing-ai-optimize.util';

@Injectable()
export class MarketingAiOrchestratorService {
  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly llm: AiLlmClient,
  ) {}

  get promptVersion(): string {
    return MKT_AI_PROMPT_VERSION;
  }

  get stubMode(): boolean {
    return !this.aiConfig.llmApiKey;
  }

  get modelName(): string {
    return this.config.mktAiModel || this.aiConfig.llmModel || 'gpt-4o-mini';
  }

  async generateStrategy(
    brief: MktAiBrief,
    opts?: {
      ragPromptBlock?: string;
      ragCitations?: Record<string, MktAiCitation[]>;
      playbookPromptBlock?: string;
      stubSwotJson?: Record<string, unknown>;
    },
  ): Promise<MktAiStrategyOutput> {
    const fallback = this.buildStrategyStub(brief, opts?.stubSwotJson);
    if (opts?.ragCitations && Object.keys(opts.ragCitations).length) {
      fallback.rag_citations = opts.ragCitations;
    }
    const { parsed } = await this.llm.completeJson({
      systemPrompt: MKT_AI_STRATEGY_SYSTEM,
      userContent: buildStrategyUserPrompt(brief, opts?.ragPromptBlock, opts?.playbookPromptBlock),
      model: this.modelName,
      stubJson: () => fallback as unknown as Record<string, unknown>,
    });
    const out = normalizeStrategyOutput(parsed, fallback);
    if (opts?.ragCitations && Object.keys(opts.ragCitations).length) {
      out.rag_citations = opts.ragCitations;
    }
    return out;
  }

  async generateCampaigns(
    brief: MktAiBrief,
    opts?: { playbookPromptBlock?: string },
  ): Promise<MktAiCampaignDraft[]> {
    const fallback = this.buildCampaignsStub(brief);
    const { parsed } = await this.llm.completeJson({
      systemPrompt: MKT_AI_CAMPAIGN_SYSTEM,
      userContent: buildCampaignUserPrompt(brief, opts?.playbookPromptBlock),
      model: this.modelName,
      stubJson: () => ({ campaigns: fallback }),
    });
    return normalizeCampaignsOutput(parsed, fallback);
  }

  async generateContent(
    brief: MktAiBrief,
    campaigns: MktAiCampaignDraft[],
  ): Promise<MktAiContentOutput> {
    const fallback = this.buildContentStub(brief, campaigns);
    const { parsed } = await this.llm.completeJson({
      systemPrompt: MKT_AI_CONTENT_SYSTEM,
      userContent: buildContentUserPrompt(brief, campaigns),
      model: this.modelName,
      stubJson: () => fallback as unknown as Record<string, unknown>,
    });
    return normalizeContentOutput(parsed, fallback);
  }

  async generateOptimizeRecommendations(
    input: MktAiOptimizeContextInput,
  ): Promise<MktAiOptimizeRecommendation[]> {
    const fallback = buildRuleBasedOptimizeRecommendations(input);
    const { parsed } = await this.llm.completeJson({
      systemPrompt: MKT_AI_OPTIMIZE_SYSTEM,
      userContent: buildOptimizeUserPrompt(input),
      model: this.modelName,
      stubJson: () => ({ recommendations: fallback }),
    });
    return normalizeOptimizeRecommendations(parsed, fallback);
  }

  private buildStrategyStub(
    brief: MktAiBrief,
    stubSwotJson?: Record<string, unknown>,
  ): MktAiStrategyOutput {
    const brand = String(brief.brand_name ?? 'Khách hàng').trim();
    const industry = String(brief.industry ?? 'B2B').trim();
    const geo = (brief.geo_markets ?? []).join(', ') || 'Việt Nam';
    const objective = String(brief.objective ?? 'lead');
    const budget = Number(brief.budget_monthly_vnd ?? 0);
    const pain = String(brief.challenges ?? '').trim();
    const usp = String(brief.usp ?? 'Giá trị cốt lõi thương hiệu').trim();

    const strategy_framework: Record<string, string> = {
      target_market: `${brand} — ${industry} tại ${geo}; mục tiêu ${objective}.`,
      market_message: usp.slice(0, 280),
      media_reach:
        objective === 'lead'
          ? 'Meta lead form 35% · Google Search intent 30% · Landing CRO 15% · Email nurture 10% · Dự phòng test 10%'
          : 'Meta reach 30% · Video/TikTok 25% · Google 20% · Content/SEO 15% · Dự phòng 10%',
      conversion_strategy:
        'Landing + form chuẩn UTM · SLA SDR ≤4h · nurture email D0–D14 · dashboard CPL theo kênh.',
      retention_system: 'CSKH proactive · NPS hàng quý · upsell gói dịch vụ mở rộng.',
      nurture_system:
        'Email automation 5-touch · retargeting warm audience · Zalo OA nurture (nếu có).',
    };

    for (const key of STRATEGY_FRAMEWORK_KEYS) {
      if (!strategy_framework[key]) strategy_framework[key] = '';
    }

    const target_market_prof: Record<string, string> = {};
    target_market_prof.market_context = `Thị trường ${industry} tại ${geo} đang cạnh tranh CPL; ${pain.slice(0, 200)}`;
    target_market_prof.tam_sam_som = `TAM: SME ${industry} khu vực ${geo}; SAM: ngân sách MKT ${budget > 0 ? `${Math.round(budget / 1_000_000)}M/tháng` : 'chưa xác định'}.`;
    target_market_prof.geo_behavior = `Tập trung ${geo}; hành vi tìm kiếm solution online + social proof.`;
    target_market_prof.segmentation_icp = `ICP: doanh nghiệp ${industry} cần ${objective === 'lead' ? 'lead chất lượng' : 'nhận diện thương hiệu'}; pain: ${pain.slice(0, 120)}.`;
    target_market_prof.personas_roles = 'Owner/GM · Trưởng MKT · Người ra quyết định mua dịch vụ agency.';
    target_market_prof.pains_desired_outcomes = `${pain} → Kết quả mong muốn: ${usp.slice(0, 120)}.`;
    target_market_prof.jobs_to_be_done = 'Tạo pipeline ổn định · Giảm CPL · Có dashboard minh bạch.';
    target_market_prof.buy_triggers_obstacles =
      'Trigger: KPI lệch / mùa cao điểm. Rào cản: ngân sách, trust agency.';
    target_market_prof.criteria_vs_alternatives =
      'So sánh in-house vs agency; ưu tiên SLA + minh bạch số liệu.';
    target_market_prof.insights_evidence = `Insight từ brief: ${pain.slice(0, 100)}`;
    target_market_prof.segment_priorities = `Phân khúc 1: ${geo} core; Phân khúc 2: online nationwide.`;
    target_market_prof.success_hypotheses_next =
      'Giả thuyết: Meta + Google đạt CPL target trong 4 tuần; bước tiếp: Launch QA.';

    for (const key of TARGET_MARKET_PROF_KEYS) {
      if (!target_market_prof[key]) target_market_prof[key] = '';
    }

    const swot_json = (stubSwotJson as Record<string, string[]> | undefined) ?? {
      strengths: [usp.slice(0, 80) || 'Sản phẩm/dịch vụ rõ ràng'],
      weaknesses: ['Brand awareness cần tăng'],
      opportunities: [`Tăng trưởng ${objective} trên ${geo}`],
      threats: (brief.competitors ?? []).length
        ? brief.competitors!.map((c) => `Cạnh tranh ${c}`)
        : ['CPL tăng theo mùa'],
    };

    return { strategy_framework, target_market_prof, swot_json };
  }

  private buildCampaignsStub(brief: MktAiBrief): MktAiCampaignDraft[] {
    const objective = String(brief.objective ?? 'lead');
    if (objective === 'awareness') {
      return [
        {
          name: 'Video Awareness TikTok/Meta',
          objective: 'awareness',
          channel_mix: ['TikTok', 'Meta Reach'],
          budget_pct: 45,
          timeline_weeks: 'W1–W6',
          milestones: ['Brief', 'Creative', 'Launch', 'Optimize'],
          kpis: ['CPV', 'Reach', 'Freq ≤3'],
        },
        {
          name: 'Brand Search Lift',
          objective: 'awareness',
          channel_mix: ['Google Display', 'YouTube'],
          budget_pct: 25,
          timeline_weeks: 'W2–W8',
          milestones: ['Setup', 'Run', 'Report'],
          kpis: ['CPM', 'Brand search lift'],
        },
      ];
    }
    return [
      {
        name: 'Meta Lead Gen Q3',
        objective: 'lead',
        channel_mix: ['Meta', 'Landing'],
        budget_pct: 35,
        timeline_weeks: 'W1–W4',
        milestones: ['Brief', 'Launch', 'Optimize'],
        kpis: ['CPL ≤180k', 'CTR ≥1.2%'],
      },
      {
        name: 'Google Search B2B Intent',
        objective: 'lead',
        channel_mix: ['Google Search', 'Landing'],
        budget_pct: 25,
        timeline_weeks: 'W1–W6',
        milestones: ['Keywords', 'Launch', 'Scale'],
        kpis: ['CPL ≤220k', 'CVR landing ≥4%'],
      },
    ];
  }

  private buildContentStub(
    brief: MktAiBrief,
    campaigns: MktAiCampaignDraft[],
  ): MktAiContentOutput {
    const brand = String(brief.brand_name ?? 'Thương hiệu').trim();
    const calendar: Array<Record<string, string>> = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * 2);
      calendar.push({
        date: d.toISOString().slice(0, 10),
        type: i % 3 === 0 ? 'social_post' : i % 3 === 1 ? 'blog' : 'email',
        channel: i % 2 === 0 ? 'Meta' : 'Email',
        copy: `${brand}: ${String(brief.usp ?? brief.challenges ?? '').slice(0, 120)}`,
      });
    }
    const ad_copy = campaigns.flatMap((c, idx) => [
      {
        variant: `${idx + 1}A`,
        headline: `${brand} — ${c.name}`,
        body: String(brief.challenges ?? '').slice(0, 160),
        cta: 'Nhận tư vấn miễn phí',
      },
    ]);
    const content_json = {
      calendar,
      ad_copy,
      email_sequence: ['D0 welcome', 'D3 case study', 'D7 offer'],
    };
    const assets = calendar.slice(0, 8).map((row) => ({
      asset_type:
        row.type === 'social_post' ? 'social_post' : row.type === 'blog' ? 'blog' : 'email_sequence',
      title: row.type,
      body_text: row.copy,
      scheduled_date: row.date,
      channel: row.channel,
      content_json: row,
    }));
    return { content_json, assets };
  }
}
