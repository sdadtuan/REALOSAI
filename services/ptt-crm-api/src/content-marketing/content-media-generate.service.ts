import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMediaImageProvider } from './content-media-image.provider';
import {
  assertMediaJobEligible,
  mergeMediaJson,
  resolveAspectRatio,
} from './content-media.util';
import { itemEligibleForVideoShort } from './content-media-video.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktItemRow, CmktJobRow } from './content-marketing.types';
import { SocialVideoService } from './video-social/social-video.service';

const MEDIA_JOB_TYPES = new Set([
  'image_generate',
  'carousel_slides_generate',
  'visual_qa_score',
  'video_short_generate',
  'social_storyboard',
  'social_render',
  'social_transcode',
  'social_qa',
]);

@Injectable()
export class ContentMediaGenerateService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly worker: ContentJobWorkerService,
    private readonly images: ContentMediaImageProvider,
    @Inject(forwardRef(() => SocialVideoService))
    private readonly social: SocialVideoService,
  ) {}

  private ensureMediaEnabled(): void {
    if (!this.config.contentMarketingMediaEnabled || !this.config.contentMarketingImageGenEnabled) {
      throw new BadRequestException({
        error: 'cmkt_media_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_MEDIA_ENABLED=1 và PTT_CMKT_IMAGE_GEN=1.',
      });
    }
  }

  private ensureVideoEnabled(): void {
    this.ensureMediaEnabled();
    if (!this.config.contentMarketingVideoGenEnabled) {
      throw new BadRequestException({
        error: 'cmkt_video_disabled',
        message: 'Bật PTT_CMKT_VIDEO_GEN=1 để generate short video.',
      });
    }
  }

  private async assertDailyCap(lifecycleId: number): Promise<void> {
    const count = await this.repo.countMediaJobsToday(lifecycleId);
    if (count >= this.config.contentMarketingMediaDailyCap) {
      throw new BadRequestException({
        error: 'media_daily_cap',
        message: 'Đã đạt giới hạn media jobs hôm nay cho lifecycle.',
        cap: this.config.contentMarketingMediaDailyCap,
        used: count,
      });
    }
  }

  async startImageJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startMediaJob(lifecycleId, itemId, 'image_generate', body, actorEmail);
  }

  async startCarouselSlidesJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startMediaJob(lifecycleId, itemId, 'carousel_slides_generate', body, actorEmail);
  }

  async startVisualQaJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startMediaJob(lifecycleId, itemId, 'visual_qa_score', body, actorEmail);
  }

  async startVideoShortJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    this.ensureVideoEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!itemEligibleForVideoShort(item)) {
      throw new BadRequestException({
        error: 'video_format_required',
        message: 'Short video chỉ cho format video_script hoặc channel short_video.',
      });
    }
    if (item.media_json?.video_studio === 'cinematic') {
      throw new BadRequestException({ error: 'studio_mismatch', message: 'studio_mismatch' });
    }
    assertMediaJobEligible(item, body.allow_draft_watermark === true);

    const studio = item.media_json?.video_studio;
    const socialOrEmpty = studio == null || studio === 'social';
    if (this.config.contentMarketingVideoOneShot && socialOrEmpty) {
      return this.social.startOneShot(lifecycleId, itemId, body, actorEmail);
    }

    return this.social.startStoryboard(lifecycleId, itemId, body, actorEmail);
  }

  startStoryboard(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.social.startStoryboard(lifecycleId, itemId, body, actorEmail);
  }

  patchStoryboard(
    lifecycleId: number,
    itemId: number,
    beatsPatch: unknown,
  ): Promise<CmktItemRow> {
    return this.social.patchStoryboard(lifecycleId, itemId, beatsPatch);
  }

  startRender(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.social.startRender(lifecycleId, itemId, body, actorEmail);
  }

  startTranscode(
    lifecycleId: number,
    itemId: number,
    packs: unknown,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.social.startTranscode(lifecycleId, itemId, packs, actorEmail);
  }

  startVideoQa(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.social.startVideoQa(lifecycleId, itemId, actorEmail);
  }

  lockStudio(
    lifecycleId: number,
    itemId: number,
    studio: unknown,
  ): Promise<CmktItemRow> {
    return this.social.lockStudio(lifecycleId, itemId, studio);
  }

  private async startMediaJob(
    lifecycleId: number,
    itemId: number,
    jobType: 'image_generate' | 'carousel_slides_generate' | 'visual_qa_score',
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    this.ensureMediaEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    await this.assertDailyCap(lifecycleId);

    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    if (jobType !== 'visual_qa_score') {
      assertMediaJobEligible(item, body.allow_draft_watermark === true);
    }

    const input = {
      variant_count: body.variant_count != null ? Number(body.variant_count) : 3,
      aspect_ratio: resolveAspectRatio(body.aspect_ratio, item.channel, item.format),
      style_preset: String(body.style_preset ?? 'corporate'),
      use_approved_copy_overlay: body.use_approved_copy_overlay !== false,
      include_logo_overlay: body.include_logo_overlay === true,
      allow_draft_watermark: body.allow_draft_watermark === true,
    };

    await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'ai_pending' });

    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: jobType,
      input_json: input,
      created_by: actorEmail,
    });

    if (this.config.contentMarketingMediaAsync) {
      setImmediate(() => {
        void this.worker.processJob(job.id).catch(() => undefined);
      });
      return job;
    }

    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async selectMediaAsset(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    const assetId = String(body.asset_id ?? '').trim();
    if (!assetId) throw new BadRequestException({ error: 'asset_id_required' });

    const packAssets = Object.values(item.media_json?.video_packs ?? {});
    const assets = [
      ...(item.media_json?.ai_assets ?? []),
      ...(item.media_json?.carousel_slides ?? []),
      ...(item.media_json?.video_short ? [item.media_json.video_short] : []),
      ...packAssets,
    ];
    if (!assets.some((a) => a.id === assetId)) {
      throw new BadRequestException({ error: 'asset_not_found', asset_id: assetId });
    }

    const markSelected = (list: typeof assets) =>
      list.map((a) => ({ ...a, selected: a.id === assetId }));

    const media = mergeMediaJson(item.media_json, {
      selected_asset_id: assetId,
      ai_assets: item.media_json?.ai_assets ? markSelected(item.media_json.ai_assets) : undefined,
      carousel_slides: item.media_json?.carousel_slides
        ? markSelected(item.media_json.carousel_slides)
        : undefined,
      video_short: item.media_json?.video_short
        ? { ...item.media_json.video_short, selected: item.media_json.video_short.id === assetId }
        : undefined,
      video_packs: item.media_json?.video_packs
        ? Object.fromEntries(
            Object.entries(item.media_json.video_packs).map(([key, asset]) => [
              key,
              { ...asset, selected: asset.id === assetId },
            ]),
          )
        : undefined,
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, { media_json: media });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'media_select');
    return updated;
  }

  isMediaJobType(jobType: string): boolean {
    return MEDIA_JOB_TYPES.has(jobType);
  }
}
