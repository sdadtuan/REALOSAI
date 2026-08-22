import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { spawnSync } from 'child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { AppConfigService } from '../../config/app-config.service';
import { ContentJobWorkerService } from '../content-job-worker.service';
import { ContentMediaStockProvider } from '../content-media-stock.provider';
import { ContentMediaStorageService } from '../content-media-storage.service';
import { ContentMediaTtsProvider } from '../content-media-tts.provider';
import { itemEligibleForVideoShort } from '../content-media-video.util';
import { assertMediaJobEligible } from '../content-media.util';
import { ContentMarketingRepository } from '../content-marketing.repository';
import { ContentMarketingService } from '../content-marketing.service';
import type {
  CmktItemRow,
  CmktJobRow,
  CmktMediaAsset,
  CmktMediaJson,
  CmktVideoBeat,
  CmktVideoGenerationProgress,
  CmktVideoStoryboard,
} from '../content-marketing.types';
import { VideoLicenseRepository } from '../video-kernel/video-license.repository';
import {
  assertFfmpegAvailable,
  ffprobeBinFromFfmpeg,
  probeFile,
} from '../video-kernel/video-ffprobe.util';
import { packSpec, type PackSpec } from '../video-kernel/video-pack.util';
import { parseBeats } from './social-beat.service';
import { SocialFfmpegComposer } from './social-ffmpeg.composer';
import {
  assertScriptFitsPack,
  assertStudioWritable,
  defaultSocialTranscodePacks,
  isLikelyPlayableAudio,
  lockVideoStudio,
} from './social-studio.util';
import { scoreMaster } from './social-video-qa.service';

const LOCAL_MEDIA_ROOT = '/tmp/cmkt-media';

const SOCIAL_STEPS: CmktVideoGenerationProgress['steps'] = {
  script: 'pending',
  beats: 'pending',
  tts: 'pending',
  clips: 'pending',
  storyboard: 'pending',
  compose: 'pending',
  qa: 'pending',
  packs: 'pending',
};

@Injectable()
export class SocialVideoService {
  private readonly logger = new Logger(SocialVideoService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    @Inject(forwardRef(() => ContentJobWorkerService))
    private readonly worker: ContentJobWorkerService,
    private readonly tts: ContentMediaTtsProvider,
    private readonly stock: ContentMediaStockProvider,
    private readonly storage: ContentMediaStorageService,
    private readonly composer: SocialFfmpegComposer,
    private readonly licenses: VideoLicenseRepository,
  ) {}

  async startStoryboard(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    email: string,
  ): Promise<CmktJobRow> {
    this.ensureSocialEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    await this.assertSocialDailyCap(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialWritable(item);
    assertMediaJobEligible(item, body.allow_draft_watermark === true);
    this.assertScriptFitsPackOr400(item, body);
    await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'ai_pending' });
    return this.enqueueJob(lifecycleId, itemId, 'social_storyboard', this.storyboardInput(body, item.channel), email);
  }

  async patchStoryboard(
    lifecycleId: number,
    itemId: number,
    beatsPatch: unknown,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialStudio(item);
    const existing = item.media_json?.storyboard;
    if (!existing) {
      throw new BadRequestException({ error: 'storyboard_required', message: 'storyboard_required' });
    }
    const incoming = Array.isArray(beatsPatch)
      ? beatsPatch
      : (beatsPatch as { beats?: unknown } | null)?.beats;
    if (!Array.isArray(incoming)) {
      throw new BadRequestException({ error: 'beats_required', message: 'beats_required' });
    }
    const byId = new Map(existing.beats.map((b) => [b.id, b]));
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      const patch = raw as Partial<CmktVideoBeat> & { id?: CmktVideoBeat['id'] };
      if (!patch.id || !byId.has(patch.id)) continue;
      const cur = byId.get(patch.id)!;
      byId.set(patch.id, { ...cur, ...patch, id: cur.id });
    }
    const beats = existing.beats.map((b) => byId.get(b.id) ?? b);
    const media: CmktMediaJson = {
      ...(item.media_json ?? {}),
      storyboard: { ...existing, beats },
    };
    return this.repo.patchItem(lifecycleId, itemId, { media_json: media });
  }

  async startRender(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    email: string,
  ): Promise<CmktJobRow> {
    this.ensureSocialEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    await this.assertSocialDailyCap(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialWritable(item);
    assertMediaJobEligible(item, body.allow_draft_watermark === true);
    this.assertScriptFitsPackOr400(item, body);
    await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'ai_pending' });
    return this.enqueueJob(lifecycleId, itemId, 'social_render', this.storyboardInput(body, item.channel), email);
  }

  async startTranscode(
    lifecycleId: number,
    itemId: number,
    packs: unknown,
    email: string,
  ): Promise<CmktJobRow> {
    this.ensureSocialEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    await this.assertSocialDailyCap(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialStudio(item);
    const packList = Array.isArray(packs) ? packs.map((p) => String(p)) : [];
    return this.enqueueJob(lifecycleId, itemId, 'social_transcode', { packs: packList }, email);
  }

  async startVideoQa(
    lifecycleId: number,
    itemId: number,
    email: string,
  ): Promise<CmktJobRow> {
    this.ensureSocialEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    await this.assertSocialDailyCap(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialStudio(item);
    return this.enqueueJob(lifecycleId, itemId, 'social_qa', {}, email);
  }

  async lockStudio(
    lifecycleId: number,
    itemId: number,
    studio: unknown,
  ): Promise<CmktItemRow> {
    if (studio !== 'social') {
      throw new BadRequestException({ error: 'studio_mismatch', message: 'studio_mismatch' });
    }
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialWritable(item);
    const media = lockVideoStudio(item.media_json ?? {}, 'social');
    return this.repo.patchItem(lifecycleId, itemId, { media_json: media });
  }

  async startOneShot(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    email: string,
  ): Promise<CmktJobRow> {
    this.ensureSocialEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const used = await this.repo.countSocialJobsToday(lifecycleId);
    if (used + 2 > this.config.contentMarketingVideoSocialDailyCap) {
      throw new BadRequestException({
        error: 'video_daily_cap',
        message: 'video_daily_cap',
        cap: this.config.contentMarketingVideoSocialDailyCap,
        used,
      });
    }
    const item = await this.requireVideoItem(lifecycleId, itemId);
    this.assertSocialWritable(item);
    assertMediaJobEligible(item, body.allow_draft_watermark === true);
    this.assertScriptFitsPackOr400(item, body);
    await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'ai_pending' });
    const input = this.storyboardInput(body, item.channel);
    const storyboardJob = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: 'social_storyboard',
      input_json: input,
      created_by: email,
    });
    const storyboardResult = await this.worker.processJob(storyboardJob.id);
    if (!storyboardResult || storyboardResult.status !== 'succeeded') {
      if (storyboardResult) return storyboardResult;
      throw new BadRequestException({
        error: 'storyboard_failed',
        message: 'storyboard_failed',
        job_id: storyboardJob.id,
      });
    }
    return this.enqueueJob(lifecycleId, itemId, 'social_render', input, email);
  }

  async executeStoryboard(job: CmktJobRow, item: CmktItemRow): Promise<void> {
    const packId = String(
      job.input_json?.pack_default ?? item.media_json?.storyboard?.pack_default ?? 'reels',
    );
    const script = String(item.body_json?.markdown ?? item.title ?? '').trim();
    assertScriptFitsPack(script, packId);

    let media = lockVideoStudio(item.media_json ?? {}, 'social');
    const steps = { ...SOCIAL_STEPS, script: 'done' as const };

    const ttsResult = await this.tts.synthesize(script);
    const ttsUpload = await this.storage.uploadAsset({
      lifecycleId: job.lifecycle_id,
      itemId: item.id,
      assetId: `tts-${job.id}`,
      buffer: ttsResult.audioBuffer,
      contentType: 'audio/mpeg',
      fileExt: 'mp3',
    });
    await this.persistLocalAsset(ttsUpload.storageKey, ttsResult.audioBuffer);
    await this.safeInsertLicense({
      lifecycleId: job.lifecycle_id,
      itemId: item.id,
      assetKind: 'tts',
      provider: ttsResult.provider,
      providerId: ttsResult.voice,
      licenseName: 'first_party',
      sourceUrl: ttsUpload.url,
      localStorageKey: ttsUpload.storageKey,
    });

    const beats = parseBeats(script, ttsResult.durationSec);
    const clips = await this.stock.fetchClips(script, 4);
    for (let i = 0; i < Math.min(4, clips.length); i++) {
      const clip = clips[i];
      if (beats[i]) {
        beats[i] = {
          ...beats[i],
          clip_id: clip.id,
          clip_url: clip.url,
          license: clip.provider === 'pexels' ? 'pexels' : 'generated',
        };
      }
      await this.safeInsertLicense({
        lifecycleId: job.lifecycle_id,
        itemId: item.id,
        assetKind: 'stock_clip',
        provider: clip.provider,
        providerId: clip.id,
        licenseName: clip.provider === 'pexels' ? 'pexels_license' : 'generated',
        sourceUrl: clip.url,
        localStorageKey: null,
      });
    }

    const stylePreset = String(job.input_json?.style_preset ?? 'corporate');
    const requested = defaultSocialTranscodePacks(
      item.channel,
      packId,
      job.input_json?.requested_packs,
    );
    const storyboard: CmktVideoStoryboard = {
      version: 1,
      pack_default: packId,
      requested_packs: requested,
      style_preset: (['corporate', 'bold', 'minimal', 'playful'].includes(stylePreset)
        ? stylePreset
        : 'corporate') as CmktVideoStoryboard['style_preset'],
      voice: {
        provider: ttsResult.provider,
        voice_id: ttsResult.voice,
        lang: 'vi',
      },
      beats,
      tts: {
        storage_key: ttsUpload.storageKey,
        duration_sec: ttsResult.durationSec,
        url: ttsUpload.url,
      },
    };

    media = {
      ...media,
      video_studio: 'social',
      storyboard,
      video_generation: {
        progress_pct: 62,
        steps: {
          ...steps,
          beats: 'done',
          tts: 'done',
          clips: 'done',
          storyboard: 'done',
        },
      },
    };

    await this.repo.patchItem(job.lifecycle_id, item.id, {
      media_json: media,
      visual_status: 'ai_ready',
    });
  }

  async executeRender(job: CmktJobRow, item: CmktItemRow): Promise<void> {
    assertFfmpegAvailable(this.config.contentMarketingFfmpegBin);
    const storyboard = item.media_json?.storyboard;
    if (!storyboard) {
      throw new Error('storyboard_required');
    }
    const packId = String(job.input_json?.pack_default ?? storyboard.pack_default ?? 'reels');
    const spec = packSpec(packId);
    const workDir = join('/tmp', 'cmkt-video', String(job.id));
    await mkdir(workDir, { recursive: true });

    try {
      const voicePath = join(workDir, 'voice.wav');
      await this.materializeVoice(storyboard, voicePath);

      const clipPaths: string[] = [];
      for (let i = 0; i < storyboard.beats.length; i++) {
        const url = storyboard.beats[i]?.clip_url;
        if (!url) continue;
        const dest = join(workDir, `clip-${i}.mp4`);
        try {
          await this.materializeFile(url, dest);
          clipPaths.push(dest);
        } catch (err) {
          this.logger.warn(
            `skip clip ${i}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const captionsAssPath = join(workDir, 'captions.ass');
      const { masterPath, posterPath } = await this.composer.composeSocialMaster({
        workDir,
        ffmpegBin: this.config.contentMarketingFfmpegBin,
        beats: storyboard.beats,
        voicePath,
        clipPaths,
        captionsAssPath,
        draftWatermark: true,
        width: spec.width,
        height: spec.height,
      });

      const masterBuffer = await readFile(masterPath);
      const masterUpload = await this.storage.uploadAsset({
        lifecycleId: job.lifecycle_id,
        itemId: item.id,
        assetId: `master-${job.id}`,
        buffer: masterBuffer,
        contentType: 'video/mp4',
        fileExt: 'mp4',
      });
      await this.persistLocalAsset(masterUpload.storageKey, masterBuffer);
      const posterExt = posterPath.toLowerCase().endsWith('.jpg') ? 'jpg' : 'webp';
      const posterUpload = await this.storage.uploadAsset({
        lifecycleId: job.lifecycle_id,
        itemId: item.id,
        assetId: `poster-${job.id}`,
        buffer: await readFile(posterPath),
        contentType: posterExt === 'jpg' ? 'image/jpeg' : 'image/webp',
        fileExt: posterExt,
      });
      const srt = beatsToSrt(storyboard.beats);
      await this.storage.uploadAsset({
        lifecycleId: job.lifecycle_id,
        itemId: item.id,
        assetId: `captions-${job.id}`,
        buffer: Buffer.from(srt, 'utf8'),
        contentType: 'text/plain',
        fileExt: 'srt',
      });

      const probe = probeFile(masterPath, ffprobeBinFromFfmpeg(this.config.contentMarketingFfmpegBin));
      if (!probe.hasVideo || !probe.hasAudio) {
        throw new Error('video_probe_failed');
      }

      const licenseRows = await this.safeListLicenses(item.id);
      const qa = scoreMaster({
        probe,
        packId,
        hasCaptions: true,
        hasHookLayer: storyboard.beats.some((b) => b.id === 'hook' && Boolean(b.on_screen_text)),
        hasLogoOrSkipped: true,
        draftWatermark: true,
        visualApproved: item.visual_status === 'approved',
        licenseCount: licenseRows.length,
      });

      const asset: CmktMediaAsset = {
        id: `video-${job.id}`,
        type: 'video',
        url: masterUpload.url,
        poster_url: posterUpload.url,
        ai_generated: true,
        provider: 'ffmpeg',
        selected: true,
        duration_sec: probe.durationSec,
        draft_watermark: true,
        storage_key: masterUpload.storageKey,
      };

      const media: CmktMediaJson = {
        ...(item.media_json ?? {}),
        video_short: asset,
        video_qa: qa,
        video_generation: {
          progress_pct: 88,
          steps: {
            ...SOCIAL_STEPS,
            script: 'done',
            beats: 'done',
            tts: 'done',
            clips: 'done',
            storyboard: 'done',
            compose: 'done',
            qa: 'done',
          },
        },
        ai_assets: [asset],
        selected_asset_id: asset.id,
        provider: 'ffmpeg',
      };

      await this.repo.patchItem(job.lifecycle_id, item.id, {
        media_json: media,
        visual_status: 'ai_ready',
        production_json: {
          ...(item.production_json ?? {}),
          final_video_url: masterUpload.url,
          subtitle_text: scriptExcerpt(item),
        },
      });

      const transcodePacks = defaultSocialTranscodePacks(
        item.channel,
        packId,
        storyboard.requested_packs,
      );
      if (transcodePacks.length) {
        await this.enqueueJob(
          job.lifecycle_id,
          item.id,
          'social_transcode',
          { packs: transcodePacks },
          job.created_by,
        );
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async executeTranscode(job: CmktJobRow, item: CmktItemRow): Promise<void> {
    assertFfmpegAvailable(this.config.contentMarketingFfmpegBin);
    const masterUrl = item.media_json?.video_short?.url;
    if (!masterUrl) {
      throw new Error('master_required');
    }
    const packs = resolvePacks(
      job.input_json?.packs,
      item.media_json?.storyboard?.requested_packs,
      item.channel,
    );
    const workDir = join('/tmp', 'cmkt-video', String(job.id));
    await mkdir(workDir, { recursive: true });
    try {
      const masterPath = join(workDir, 'master.mp4');
      await this.materializeFile(masterUrl, masterPath);
      const videoPacks: Record<string, CmktMediaAsset> = { ...(item.media_json?.video_packs ?? {}) };
      for (const packId of packs) {
        const spec = packSpec(packId);
        const outPath = join(workDir, `${packId}.mp4`);
        scalePack(this.config.contentMarketingFfmpegBin, masterPath, outPath, spec);
        const uploaded = await this.storage.uploadAsset({
          lifecycleId: job.lifecycle_id,
          itemId: item.id,
          assetId: `pack-${packId}-${job.id}`,
          buffer: await readFile(outPath),
          contentType: 'video/mp4',
          fileExt: 'mp4',
        });
        videoPacks[packId] = {
          id: `pack-${packId}`,
          type: 'video',
          url: uploaded.url,
          ai_generated: true,
          provider: 'ffmpeg',
          storage_key: uploaded.storageKey,
        };
      }
      const media: CmktMediaJson = {
        ...(item.media_json ?? {}),
        video_packs: videoPacks,
        video_generation: {
          progress_pct: 100,
          steps: {
            ...SOCIAL_STEPS,
            script: 'done',
            beats: 'done',
            tts: 'done',
            clips: 'done',
            storyboard: 'done',
            compose: 'done',
            qa: 'done',
            packs: 'done',
          },
        },
      };
      await this.repo.patchItem(job.lifecycle_id, item.id, { media_json: media });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async executeQa(job: CmktJobRow, item: CmktItemRow): Promise<void> {
    const masterUrl = item.media_json?.video_short?.url;
    if (!masterUrl) {
      throw new Error('master_required');
    }
    const workDir = join('/tmp', 'cmkt-video', String(job.id));
    await mkdir(workDir, { recursive: true });
    try {
      const local = join(workDir, 'master.mp4');
      await this.materializeFile(masterUrl, local);
      const probe = probeFile(local, ffprobeBinFromFfmpeg(this.config.contentMarketingFfmpegBin));
      const packId = String(item.media_json?.storyboard?.pack_default ?? 'reels');
      const licenseRows = await this.safeListLicenses(item.id);
      const qa = scoreMaster({
        probe,
        packId,
        hasCaptions: true,
        hasHookLayer: Boolean(
          item.media_json?.storyboard?.beats.some((b) => b.id === 'hook' && b.on_screen_text),
        ),
        hasLogoOrSkipped: true,
        draftWatermark: item.media_json?.video_short?.draft_watermark !== false,
        visualApproved: item.visual_status === 'approved',
        licenseCount: licenseRows.length,
      });
      const media: CmktMediaJson = { ...(item.media_json ?? {}), video_qa: qa };
      await this.repo.patchItem(job.lifecycle_id, item.id, { media_json: media });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private ensureSocialEnabled(): void {
    if (!this.config.contentMarketingVideoGenEnabled || !this.config.contentMarketingVideoSocialEnabled) {
      throw new BadRequestException({
        error: 'cmkt_video_disabled',
        message: 'Bật PTT_CMKT_VIDEO_GEN=1 và PTT_CMKT_VIDEO_SOCIAL=1.',
      });
    }
  }

  private async assertSocialDailyCap(lifecycleId: number): Promise<void> {
    const count = await this.repo.countSocialJobsToday(lifecycleId);
    if (count >= this.config.contentMarketingVideoSocialDailyCap) {
      throw new BadRequestException({
        error: 'video_daily_cap',
        message: 'video_daily_cap',
        cap: this.config.contentMarketingVideoSocialDailyCap,
        used: count,
      });
    }
  }

  private assertSocialStudio(item: { media_json?: CmktMediaJson | null }): void {
    if (item.media_json?.video_studio === 'cinematic') {
      throw new BadRequestException({ error: 'studio_mismatch', message: 'studio_mismatch' });
    }
  }

  private assertSocialWritable(item: { media_json?: CmktMediaJson | null }): void {
    try {
      assertStudioWritable(item.media_json ?? {}, 'social');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'studio_locked';
      throw new BadRequestException({ error: msg, message: msg });
    }
    this.assertSocialStudio(item);
  }

  private assertScriptFitsPackOr400(item: CmktItemRow, body: Record<string, unknown>): void {
    const packId = String(
      body.pack_default ?? item.media_json?.storyboard?.pack_default ?? 'reels',
    );
    const script = String(item.body_json?.markdown ?? item.title ?? '').trim();
    try {
      assertScriptFitsPack(script, packId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'script_too_long';
      throw new BadRequestException({ error: msg, message: msg });
    }
  }

  private async requireVideoItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (!itemEligibleForVideoShort(item)) {
      throw new BadRequestException({
        error: 'video_format_required',
        message: 'Short video chỉ cho format video_script hoặc channel short_video.',
      });
    }
    return item;
  }

  async composeCleanMaster(
    lifecycleId: number,
    itemId: number,
    storyboard: CmktVideoStoryboard,
    sourceAsset: CmktMediaAsset,
  ): Promise<CmktMediaAsset | null> {
    try {
      assertFfmpegAvailable(this.config.contentMarketingFfmpegBin);
    } catch {
      return null;
    }

    const packId = String(storyboard.pack_default ?? 'reels');
    const spec = packSpec(packId);
    const workDir = join('/tmp', 'cmkt-video-clean', `${lifecycleId}-${itemId}-${sourceAsset.id}`);
    await mkdir(workDir, { recursive: true });

    try {
      const voicePath = join(workDir, 'voice.wav');
      await this.materializeVoice(storyboard, voicePath);

      const clipPaths: string[] = [];
      for (let i = 0; i < storyboard.beats.length; i++) {
        const url = storyboard.beats[i]?.clip_url;
        if (!url) continue;
        const dest = join(workDir, `clip-${i}.mp4`);
        try {
          await this.materializeFile(url, dest);
          clipPaths.push(dest);
        } catch (err) {
          this.logger.warn(
            `clean skip clip ${i}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const captionsAssPath = join(workDir, 'captions.ass');
      const { masterPath, posterPath } = await this.composer.composeSocialMaster({
        workDir,
        ffmpegBin: this.config.contentMarketingFfmpegBin,
        beats: storyboard.beats,
        voicePath,
        clipPaths,
        captionsAssPath,
        draftWatermark: false,
        width: spec.width,
        height: spec.height,
      });

      const cleanUpload = await this.storage.uploadAsset({
        lifecycleId,
        itemId,
        assetId: `${sourceAsset.id}-clean`,
        buffer: await readFile(masterPath),
        contentType: 'video/mp4',
        fileExt: 'mp4',
      });
      const posterExt = posterPath.toLowerCase().endsWith('.jpg') ? 'jpg' : 'webp';
      const posterUpload = await this.storage.uploadAsset({
        lifecycleId,
        itemId,
        assetId: `${sourceAsset.id}-clean-poster`,
        buffer: await readFile(posterPath),
        contentType: posterExt === 'jpg' ? 'image/jpeg' : 'image/webp',
        fileExt: posterExt,
      });

      return {
        ...sourceAsset,
        url: cleanUpload.url,
        poster_url: posterUpload.url,
        draft_watermark: false,
        storage_key: cleanUpload.storageKey,
        clean_storage_key: cleanUpload.storageKey,
      };
    } catch (err) {
      this.logger.warn(
        `clean compose skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private storyboardInput(body: Record<string, unknown>, channel?: string): Record<string, unknown> {
    const packDefault = String(body.pack_default ?? 'reels');
    return {
      pack_default: packDefault,
      style_preset: String(body.style_preset ?? 'corporate'),
      requested_packs: defaultSocialTranscodePacks(channel, packDefault, body.requested_packs),
      allow_draft_watermark: body.allow_draft_watermark === true,
    };
  }

  private async enqueueJob(
    lifecycleId: number,
    itemId: number,
    jobType: string,
    inputJson: Record<string, unknown>,
    email: string,
  ): Promise<CmktJobRow> {
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: jobType,
      input_json: inputJson,
      created_by: email,
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

  private async persistLocalAsset(storageKey: string, buffer: Buffer): Promise<void> {
    const dest = join(LOCAL_MEDIA_ROOT, storageKey);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  private async materializeVoice(
    storyboard: CmktVideoStoryboard,
    dest: string,
  ): Promise<void> {
    try {
      await this.materializeFile(storyboard.tts.url, dest, storyboard.tts.storage_key);
      const cached = await readFile(dest);
      if (isLikelyPlayableAudio(cached)) {
        return;
      }
      this.logger.warn('voice cache is stub/non-audio, synthesizing fallback');
    } catch (err) {
      this.logger.warn(
        `voice download failed, synthesizing fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const duration = Math.max(2, Math.min(60, Number(storyboard.tts.duration_sec) || 8));
    const result = spawnSync(
      this.config.contentMarketingFfmpegBin,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=440:duration=${duration}`,
        '-ac',
        '1',
        '-ar',
        '44100',
        '-c:a',
        'pcm_s16le',
        '-f',
        'wav',
        dest,
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    if (result.error || result.status !== 0 || !existsSync(dest)) {
      throw new Error('voice_missing');
    }
  }

  private async materializeFile(url: string, dest: string, storageKey?: string): Promise<void> {
    if (storageKey) {
      const cached = join(LOCAL_MEDIA_ROOT, storageKey);
      if (existsSync(cached)) {
        await copyFile(cached, dest);
        return;
      }
    }
    if (!url) {
      throw new Error('download_url_missing');
    }
    const local = url.startsWith('file://') ? url.slice('file://'.length) : url;
    if (existsSync(local)) {
      await copyFile(local, dest);
      return;
    }
    try {
      const pathname = new URL(url).pathname.replace(/^\//, '');
      const cachedFromUrl = join(LOCAL_MEDIA_ROOT, pathname);
      if (existsSync(cachedFromUrl)) {
        await copyFile(cachedFromUrl, dest);
        return;
      }
    } catch {
      /* not a URL */
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`download_failed:${res.status}`);
      }
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'fetch failed');
    }
  }

  private async safeInsertLicense(
    input: Parameters<VideoLicenseRepository['insertLicense']>[0],
  ): Promise<void> {
    try {
      await this.licenses.insertLicense(input);
    } catch (err) {
      this.logger.warn(`license insert skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async safeListLicenses(itemId: number) {
    try {
      return await this.licenses.listByItem(itemId);
    } catch (err) {
      this.logger.warn(`license list skipped: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
}

function scriptExcerpt(item: CmktItemRow): string {
  return String(item.body_json?.markdown ?? item.title ?? '').trim().slice(0, 200);
}

function resolvePacks(jobPacks: unknown, requested: string[] | undefined, channel?: string): string[] {
  if (Array.isArray(jobPacks) && jobPacks.length) {
    return jobPacks.map((p) => String(p));
  }
  if (requested?.length) {
    return defaultSocialTranscodePacks(channel, requested[0], requested);
  }
  return defaultSocialTranscodePacks(channel);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function msToSrt(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const millis = clamped % 1_000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(millis, 3)}`;
}

function beatsToSrt(beats: CmktVideoBeat[]): string {
  return beats
    .map((b, i) => {
      const text = (b.on_screen_text || b.script_excerpt || '').trim();
      return `${i + 1}\n${msToSrt(b.start_ms)} --> ${msToSrt(Math.max(b.start_ms, b.end_ms))}\n${text}\n`;
    })
    .join('\n');
}

function scalePack(ffmpegBin: string, inputPath: string, outputPath: string, spec: PackSpec): void {
  const result = spawnSync(
    ffmpegBin,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-vf',
      `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=increase,crop=${spec.width}:${spec.height},setsar=1`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    if (result.error) {
      throw new Error('ffmpeg_missing');
    }
    throw new Error(`ffmpeg_failed: ${String(result.stderr ?? '').slice(-400)}`);
  }
}
