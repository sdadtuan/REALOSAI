import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { AppConfigService } from '../config/app-config.service';
import { ContentBrandContextService } from './content-brand-context.service';
import {
  buildRegenerateSystemPrompt,
  buildRegenerateUserPrompt,
  buildDraftStub,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildVariantsStub,
  buildVariantsSystemPrompt,
  buildVariantsUserPrompt,
  buildRepurposeStub,
  buildRepurposeSystemPrompt,
  buildRepurposeUserPrompt,
  buildIdeasBulkStub,
  buildIdeasBulkSystemPrompt,
  buildIdeasBulkUserPrompt,
  hashPrompt,
  normalizeDraftOutput,
  normalizeIdeasBulkOutput,
  normalizeRepurposeOutput,
  normalizeVariantsOutput,
  resolvePromptProfile,
  type CmktGenerateInput,
  type CmktRegenerateInput,
} from './content-marketing-prompt.util';
import { sanitizeItemForPrompt } from './content-pii-consent.util';
import {
  mergeMediaJson,
  parseCarouselSlideTexts,
  resolveAspectRatio,
} from './content-media.util';
import { buildVideoShortStub } from './content-media-video.util';
import {
  aggregateIntelligence,
  buildTopicSuggestions,
  parseMetricsRange,
} from './content-intelligence.util';
import { buildContentWeeklyMemo } from './content-weekly-memo.util';
import { ContentMediaVideoProvider } from './content-media-video.provider';
import { ContentVisualQaService } from './content-visual-qa.service';
import { ContentMediaImageProvider } from './content-media-image.provider';
import { ContentMarketingRepository } from './content-marketing.repository';
import type { CmktBodyJson, CmktIdeaRow, CmktJobRow, CmktMediaAsset } from './content-marketing.types';
import { SocialVideoService } from './video-social/social-video.service';

@Injectable()
export class ContentJobWorkerService {
  private readonly logger = new Logger(ContentJobWorkerService.name);
  private readonly inFlight = new Set<number>();

  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly llm: AiLlmClient,
    private readonly agentRuns: AiAgentRunsRepository,
    private readonly repo: ContentMarketingRepository,
    private readonly brandContext: ContentBrandContextService,
    private readonly mediaImages: ContentMediaImageProvider,
    private readonly mediaVideo: ContentMediaVideoProvider,
    private readonly visualQa: ContentVisualQaService,
    @Inject(forwardRef(() => SocialVideoService))
    private readonly social: SocialVideoService,
  ) {}

  get modelName(): string {
    return this.config.mktAiModel || this.aiConfig.llmModel || 'gpt-4o-mini';
  }

  async processJob(jobId: number): Promise<CmktJobRow | null> {
    if (this.inFlight.has(jobId)) return null;
    this.inFlight.add(jobId);
    const started = Date.now();
    try {
      const claimed = await this.repo.claimContentJob(jobId);
      if (!claimed) return null;

      if (claimed.job_type === 'topic_suggest') {
        return this.processTopicSuggestJob(jobId, claimed, started);
      }

      if (claimed.job_type === 'weekly_memo') {
        return this.processWeeklyMemoJob(jobId, claimed, started);
      }

      if (claimed.job_type === 'intelligence_digest') {
        return this.processIntelligenceDigestJob(jobId, claimed, started);
      }

      if (claimed.job_type === 'ideas_bulk') {
        return this.processIdeasBulkJob(jobId, claimed, started);
      }

      const item =
        claimed.item_id != null
          ? await this.repo.getItemById(claimed.lifecycle_id, claimed.item_id)
          : null;
      if (!item) {
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: 'item_not_found',
        });
      }

      if (
        claimed.job_type === 'image_generate' ||
        claimed.job_type === 'carousel_slides_generate' ||
        claimed.job_type === 'visual_qa_score' ||
        claimed.job_type === 'video_short_generate' ||
        claimed.job_type === 'social_storyboard' ||
        claimed.job_type === 'social_render' ||
        claimed.job_type === 'social_transcode' ||
        claimed.job_type === 'social_qa'
      ) {
        return this.processMediaJob(jobId, claimed, item, started);
      }

      const brandRaw = await this.brandContext.resolveForLifecycle(claimed.lifecycle_id);
      const piiConsent = brandRaw.pii_consent === true;
      const brand = brandRaw;
      const promptItem = sanitizeItemForPrompt(item, piiConsent);
      const genInput = (claimed.input_json ?? {}) as CmktGenerateInput;
      const profile = resolvePromptProfile(item.channel, item.format);

      let systemPrompt: string;
      let userPrompt: string;
      let stubJson: () => Record<string, unknown>;
      let useCase: string;
      let versionReason = 'ai_generate';

      if (claimed.job_type === 'draft_generate') {
        systemPrompt = buildDraftSystemPrompt(profile);
        userPrompt = buildDraftUserPrompt(promptItem, brand, genInput);
        stubJson = () => buildDraftStub(promptItem, brand, genInput);
        useCase = 'cmkt_draft_generate';
      } else if (claimed.job_type === 'variant_generate') {
        systemPrompt = buildVariantsSystemPrompt(profile);
        userPrompt = buildVariantsUserPrompt(promptItem, brand, genInput);
        stubJson = () => buildVariantsStub(promptItem, genInput);
        useCase = 'cmkt_variant_generate';
      } else if (claimed.job_type === 'regenerate') {
        const regInput = genInput as CmktRegenerateInput;
        const existingMarkdown = String(item.body_json?.markdown ?? '').trim();
        if (!existingMarkdown) {
          return this.repo.finishContentJob(jobId, {
            status: 'failed',
            error_text: 'regenerate_body_required',
          });
        }
        systemPrompt = buildRegenerateSystemPrompt(profile, regInput.mode ?? 'rewrite');
        userPrompt = buildRegenerateUserPrompt(promptItem, brand, regInput, existingMarkdown);
        stubJson = () => buildDraftStub(promptItem, brand, regInput);
        useCase = 'cmkt_regenerate';
        versionReason = 'ai_regenerate';
      } else if (claimed.job_type === 'repurpose') {
        const sourceId = Number(claimed.input_json?.source_item_id ?? 0);
        const source =
          sourceId > 0 ? await this.repo.getItemById(claimed.lifecycle_id, sourceId) : null;
        if (!source) {
          return this.repo.finishContentJob(jobId, {
            status: 'failed',
            error_text: 'repurpose_source_not_found',
          });
        }
        const targetProfile = String(
          claimed.input_json?.prompt_profile ?? resolvePromptProfile(item.channel, item.format),
        ) as ReturnType<typeof resolvePromptProfile>;
        systemPrompt = buildRepurposeSystemPrompt(targetProfile);
        userPrompt = buildRepurposeUserPrompt(
          source,
          { channel: item.channel, format: item.format, title: item.title },
          brand,
          claimed.input_json?.optimize_hooks !== false,
        );
        stubJson = () =>
          buildRepurposeStub(source, { channel: item.channel, format: item.format, title: item.title });
        useCase = 'cmkt_repurpose';
      } else {
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: `unsupported_job_type:${claimed.job_type}`,
        });
      }

      const promptHash = hashPrompt(systemPrompt, userPrompt);
      let aiRunId: string | null = null;

      try {
        const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
          systemPrompt,
          userContent: userPrompt,
          model: this.modelName,
          stubJson,
        });

        if (await this.agentRuns.tableReady()) {
          const run = await this.agentRuns.insertRun({
            agentName: 'content_marketing',
            useCase,
            modelName,
            promptHash,
            inputJson: {
              lifecycle_id: claimed.lifecycle_id,
              item_id: item.id,
              job_id: jobId,
              profile,
              stub_mode: stubMode,
            },
            outputJson: parsed,
            status: 'succeeded',
            latencyMs: Date.now() - started,
            tokenUsage,
            actorId: claimed.created_by,
          });
          aiRunId = run.id;
        }

        if (claimed.job_type === 'draft_generate' || claimed.job_type === 'regenerate') {
          const draft = normalizeDraftOutput(parsed, stubJson());
          const bodyJson: CmktBodyJson = {
            markdown: draft.markdown,
            html: item.body_json?.html ?? '',
            variants: item.body_json?.variants ?? [],
          };
          await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
          const versionNo = await this.repo.insertItemVersion(
            item.id,
            bodyJson,
            claimed.created_by,
            versionReason,
            aiRunId,
          );
          return this.repo.finishContentJob(jobId, {
            status: 'succeeded',
            output_json: {
              body_json: bodyJson,
              version_no: versionNo,
              profile,
              stub_mode: !this.aiConfig.llmApiKey,
              regenerate: claimed.job_type === 'regenerate',
              mode: claimed.job_type === 'regenerate' ? (genInput as CmktRegenerateInput).mode ?? 'rewrite' : undefined,
              pii_consent: piiConsent,
            },
            ai_run_id: aiRunId,
          });
        }

        if (claimed.job_type === 'repurpose') {
          const repurpose = normalizeRepurposeOutput(parsed, stubJson());
          const bodyJson: CmktBodyJson = {
            markdown: repurpose.markdown,
            html: item.body_json?.html ?? '',
            variants: item.body_json?.variants ?? [],
          };
          await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
          const versionNo = await this.repo.insertItemVersion(
            item.id,
            bodyJson,
            claimed.created_by,
            'repurpose',
            aiRunId,
          );
          return this.repo.finishContentJob(jobId, {
            status: 'succeeded',
            output_json: { body_json: bodyJson, version_no: versionNo, stub_mode: !this.aiConfig.llmApiKey },
            ai_run_id: aiRunId,
          });
        }

        const minCount = Math.min(Math.max(Number(genInput.variant_count ?? 3), 3), 5);
        const variants = normalizeVariantsOutput(parsed, stubJson(), minCount);
        const bodyJson: CmktBodyJson = {
          markdown: item.body_json?.markdown ?? '',
          html: item.body_json?.html ?? '',
          variants,
        };
        await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
        const versionNo = await this.repo.insertItemVersion(
          item.id,
          bodyJson,
          claimed.created_by,
          'ai_generate',
          aiRunId,
        );
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: {
            variants,
            variant_count: variants.length,
            version_no: versionNo,
            profile,
            stub_mode: !this.aiConfig.llmApiKey,
          },
          ai_run_id: aiRunId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`cmkt job ${jobId} AI failed: ${message}`);
        if (await this.agentRuns.tableReady()) {
          try {
            const run = await this.agentRuns.insertRun({
              agentName: 'content_marketing',
              useCase,
              modelName: this.modelName,
              promptHash,
              inputJson: { job_id: jobId, item_id: item.id },
              outputJson: {},
              status: 'failed',
              latencyMs: Date.now() - started,
              errorMessage: message,
              actorId: claimed.created_by,
            });
            aiRunId = run.id;
          } catch {
            /* ignore audit failure */
          }
        }
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: message,
          ai_run_id: aiRunId,
        });
      }
    } finally {
      this.inFlight.delete(jobId);
    }
  }

  private async processMediaJob(
    jobId: number,
    claimed: CmktJobRow,
    item: NonNullable<Awaited<ReturnType<ContentMarketingRepository['getItemById']>>>,
    started: number,
  ): Promise<CmktJobRow | null> {
    const input = claimed.input_json ?? {};
    const aspectRatio = resolveAspectRatio(input.aspect_ratio, item.channel, item.format);
    const stylePreset = String(input.style_preset ?? 'corporate');
    const draftWatermark = input.allow_draft_watermark === true || item.status === 'draft';
    const approvedCopy = String(item.body_json?.markdown ?? item.title).trim();
    const brandContext = await this.brandContext.resolveForLifecycle(claimed.lifecycle_id);

    try {
      if (
        claimed.job_type === 'social_storyboard' ||
        claimed.job_type === 'social_render' ||
        claimed.job_type === 'social_transcode' ||
        claimed.job_type === 'social_qa'
      ) {
        return this.processSocialJob(jobId, claimed, item, started);
      }

      if (claimed.job_type === 'video_short_generate') {
        const script = approvedCopy;
        const provider = this.config.contentMarketingVideoProvider;
        if (provider !== 'stub') {
          await this.social.executeStoryboard(claimed, item);
          const latest =
            (await this.repo.getItemById(claimed.lifecycle_id, item.id)) ?? item;
          await this.social.executeRender(claimed, latest);
          const refreshed =
            (await this.repo.getItemById(claimed.lifecycle_id, item.id)) ?? latest;
          return this.repo.finishContentJob(jobId, {
            status: 'succeeded',
            output_json: {
              video_short: refreshed.media_json?.video_short,
              video_generation: refreshed.media_json?.video_generation,
              video_qa: refreshed.media_json?.video_qa,
              latency_ms: Date.now() - started,
            },
          });
        }

        const { asset, progress } = buildVideoShortStub({
          lifecycleId: claimed.lifecycle_id,
          itemId: item.id,
          script,
          provider: this.config.contentMarketingVideoProvider,
          cdnBase: this.config.contentMarketingCdnBase,
        });
        const media = mergeMediaJson(item.media_json, {
          video_short: asset,
          video_generation: progress,
          ai_assets: [asset],
          selected_asset_id: asset.id,
          provider: asset.provider,
          aspect_ratio: resolveAspectRatio(input.aspect_ratio, item.channel, item.format),
        });
        const qa = this.visualQa.scoreAssets([asset], {
          aspectRatio: resolveAspectRatio(input.aspect_ratio, item.channel, item.format),
        });
        media.visual_qa = qa;
        await this.repo.patchItem(claimed.lifecycle_id, item.id, {
          media_json: media,
          visual_status: 'ai_ready',
          production_json: {
            ...(item.production_json ?? {}),
            final_video_url: asset.url,
            subtitle_text: script.slice(0, 200),
          },
        });
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: {
            video_short: asset,
            video_generation: progress,
            visual_qa: qa,
            latency_ms: Date.now() - started,
          },
        });
      }

      if (claimed.job_type === 'visual_qa_score') {
        const assets = [
          ...(item.media_json?.ai_assets ?? []),
          ...(item.media_json?.carousel_slides ?? []),
        ];
        const qa = this.visualQa.scoreAssets(assets, { aspectRatio });
        const media = mergeMediaJson(item.media_json, { visual_qa: qa });
        await this.repo.patchItem(claimed.lifecycle_id, item.id, {
          media_json: media,
          visual_status: item.visual_status === 'ai_pending' ? 'ai_ready' : item.visual_status,
        });
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: { visual_qa: qa },
        });
      }

      let assets: CmktMediaAsset[] = [];
      if (claimed.job_type === 'carousel_slides_generate') {
        const slides = parseCarouselSlideTexts(approvedCopy);
        const bundle = await this.mediaImages.generateImages({
          lifecycleId: claimed.lifecycle_id,
          itemId: item.id,
          variantCount: slides.length,
          aspectRatio,
          stylePreset,
          title: item.title,
          approvedCopy,
          draftWatermark,
          slideTexts: slides,
          assetType: 'carousel_slide',
          brandContext,
        });
        const assets = bundle.assets;
        const media = mergeMediaJson(item.media_json, {
          carousel_slides: assets,
          ai_assets: assets,
          aspect_ratio: aspectRatio,
          style_preset: stylePreset,
          provider: this.mediaImages.providerName,
          prompt_hash: assets[0]?.prompt_hash,
        });
        media.visual_qa = {
          score: bundle.qa.score,
          checks: bundle.qa.checks,
          blocked: bundle.qa.blocked,
          brand_delta_e_max: bundle.qa.brand_delta_e_max,
          ocr_confidence: bundle.qa.ocr_confidence,
        };
        await this.repo.patchItem(claimed.lifecycle_id, item.id, {
          media_json: media,
          visual_status: 'ai_ready',
        });
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: {
            carousel_slides: assets,
            visual_qa: media.visual_qa,
            latency_ms: Date.now() - started,
          },
        });
      }

      const variantCount = Math.min(Math.max(Number(input.variant_count ?? 3), 1), 5);
      const bundle = await this.mediaImages.generateImages({
        lifecycleId: claimed.lifecycle_id,
        itemId: item.id,
        variantCount,
        aspectRatio,
        stylePreset,
        title: item.title,
        approvedCopy,
        draftWatermark,
        assetType: 'image',
        brandContext,
      });
      assets = bundle.assets;
      const media = mergeMediaJson(item.media_json, {
        ai_assets: assets,
        aspect_ratio: aspectRatio,
        style_preset: stylePreset,
        provider: this.mediaImages.providerName,
        prompt_hash: assets[0]?.prompt_hash,
        selected_asset_id: assets.find((a) => a.selected)?.id ?? assets[0]?.id ?? null,
      });
      media.visual_qa = {
        score: bundle.qa.score,
        checks: bundle.qa.checks,
        blocked: bundle.qa.blocked,
        brand_delta_e_max: bundle.qa.brand_delta_e_max,
        ocr_confidence: bundle.qa.ocr_confidence,
      };
      await this.repo.patchItem(claimed.lifecycle_id, item.id, {
        media_json: media,
        visual_status: 'ai_ready',
      });
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          ai_assets: assets,
          visual_qa: media.visual_qa,
          latency_ms: Date.now() - started,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.patchItem(claimed.lifecycle_id, item.id, { visual_status: 'rejected' });
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }

  private async processSocialJob(
    jobId: number,
    claimed: CmktJobRow,
    item: NonNullable<Awaited<ReturnType<ContentMarketingRepository['getItemById']>>>,
    started: number,
  ): Promise<CmktJobRow | null> {
    try {
      if (claimed.job_type === 'social_storyboard') {
        await this.social.executeStoryboard(claimed, item);
      } else if (claimed.job_type === 'social_render') {
        await this.social.executeRender(claimed, item);
      } else if (claimed.job_type === 'social_transcode') {
        await this.social.executeTranscode(claimed, item);
      } else {
        await this.social.executeQa(claimed, item);
      }
      const refreshed =
        (await this.repo.getItemById(claimed.lifecycle_id, item.id)) ?? item;
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          video_short: refreshed.media_json?.video_short,
          storyboard: refreshed.media_json?.storyboard,
          video_generation: refreshed.media_json?.video_generation,
          video_qa: refreshed.media_json?.video_qa,
          video_packs: refreshed.media_json?.video_packs,
          latency_ms: Date.now() - started,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (claimed.job_type === 'social_storyboard' || claimed.job_type === 'social_render') {
        await this.repo.patchItem(claimed.lifecycle_id, item.id, { visual_status: 'rejected' });
      }
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }

  private async processTopicSuggestJob(
    jobId: number,
    claimed: CmktJobRow,
    started: number,
  ): Promise<CmktJobRow | null> {
    try {
      const suggestions = await this.buildTopicSuggestionsForJob(claimed);
      await this.repo.setLatestTopicSuggestions(claimed.lifecycle_id, suggestions);
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          suggestions,
          range: String(claimed.input_json?.range ?? '30d'),
          latency_ms: Date.now() - started,
          stub_mode: !this.aiConfig.llmApiKey,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }

  private async buildTopicSuggestionsForJob(claimed: CmktJobRow): Promise<string[]> {
    const range = parseMetricsRange(String(claimed.input_json?.range ?? '30d'));
    const [rows, publishedByChannel, brand, pillars] = await Promise.all([
      this.repo.listLifecycleMetricsInRange(claimed.lifecycle_id, range.fromDate, range.toDate),
      this.repo.countPublishedItemsByChannel(claimed.lifecycle_id, range.fromDate, range.toDate),
      this.brandContext.resolveForLifecycle(claimed.lifecycle_id),
      this.repo.listPillars(claimed.lifecycle_id),
    ]);
    const intelligence = aggregateIntelligence(rows, range, publishedByChannel);
    return buildTopicSuggestions({
      intelligence,
      pillarNames: pillars.map((p) => p.name),
      brandName: String(brand.brand_name ?? 'Brand'),
    });
  }

  private async processIntelligenceDigestJob(
    jobId: number,
    claimed: CmktJobRow,
    started: number,
  ): Promise<CmktJobRow | null> {
    try {
      const suggestions = await this.buildTopicSuggestionsForJob(claimed);
      await this.repo.setLatestTopicSuggestions(claimed.lifecycle_id, suggestions);
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          suggestions,
          range: String(claimed.input_json?.range ?? '30d'),
          latency_ms: Date.now() - started,
          digest: true,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }

  private async processWeeklyMemoJob(
    jobId: number,
    claimed: CmktJobRow,
    started: number,
  ): Promise<CmktJobRow | null> {
    try {
      const range = parseMetricsRange(String(claimed.input_json?.range ?? '7d'));
      const [rows, publishedByChannel, brand, pillars, counts, reviewSummary, cached] =
        await Promise.all([
          this.repo.listLifecycleMetricsInRange(claimed.lifecycle_id, range.fromDate, range.toDate),
          this.repo.countPublishedItemsByChannel(claimed.lifecycle_id, range.fromDate, range.toDate),
          this.brandContext.resolveForLifecycle(claimed.lifecycle_id),
          this.repo.listPillars(claimed.lifecycle_id),
          this.repo.getContextCounts(claimed.lifecycle_id),
          this.repo.getReviewQueueSummary(claimed.lifecycle_id),
          this.repo.getLatestTopicSuggestions(claimed.lifecycle_id),
        ]);
      const intelligence = aggregateIntelligence(rows, range, publishedByChannel, cached);
      const weekLabel = `${range.fromDate} → ${range.toDate}`;
      const memo = buildContentWeeklyMemo({
        brandName: String(brand.brand_name ?? 'Brand'),
        weekLabel,
        range,
        intelligence,
        counts,
        reviewSummary,
        suggestions: cached,
        pillars: pillars.map((p) => p.name),
      });
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          memo,
          range: range.range,
          latency_ms: Date.now() - started,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }

  private async processIdeasBulkJob(
    jobId: number,
    claimed: CmktJobRow,
    started: number,
  ): Promise<CmktJobRow | null> {
    try {
      const ideaCount = Math.min(Math.max(Number(claimed.input_json?.idea_count ?? 30), 10), 40);
      const brandCtx = await this.brandContext.resolveForLifecycle(claimed.lifecycle_id);
      const pillars = await this.repo.listPillars(claimed.lifecycle_id);
      const brand = {
        brand_name: String(brandCtx.brand_name ?? 'Brand'),
        audience: String(brandCtx.audience ?? ''),
        pillars: pillars.map((p) => ({ name: p.name, goal: p.goal })),
      };
      const systemPrompt = buildIdeasBulkSystemPrompt();
      const userPrompt = buildIdeasBulkUserPrompt(brand, {
        idea_count: ideaCount,
        month_label:
          claimed.input_json?.month_label != null
            ? String(claimed.input_json.month_label)
            : undefined,
      });
      const stubJson = () => buildIdeasBulkStub(brand, { idea_count: ideaCount });
      const promptHash = hashPrompt(systemPrompt, userPrompt);

      const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
        systemPrompt,
        userContent: userPrompt,
        model: this.modelName,
        stubJson,
      });

      const drafts = normalizeIdeasBulkOutput(parsed, stubJson(), ideaCount);
      const pillarByName = new Map(pillars.map((p) => [p.name.toLowerCase(), p.id]));
      const created: CmktIdeaRow[] = [];
      for (const draft of drafts) {
        const pillarId =
          draft.pillar_name != null
            ? pillarByName.get(draft.pillar_name.toLowerCase()) ?? null
            : null;
        const row = await this.repo.createIdea(claimed.lifecycle_id, {
          title: draft.title,
          hook: draft.hook,
          target_goal: draft.target_goal || 'engagement',
          channel_hints: draft.channel_hints,
          pillar_id: pillarId,
          status: 'backlog',
          meta_json: { source_job: jobId, profile: 'ideas_monthly' },
          source: 'ai_bulk',
          created_by: claimed.created_by,
        });
        created.push(row);
      }

      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          ideas_created: created.length,
          idea_ids: created.map((i) => i.id),
          stub_mode: stubMode,
          latency_ms: Date.now() - started,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }
}
