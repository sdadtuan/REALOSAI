import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import type { CmktMediaAsset, CmktVideoGenerationProgress } from './content-marketing.types';
import { ContentMediaStockProvider } from './content-media-stock.provider';
import { ContentMediaStorageService } from './content-media-storage.service';
import { ContentMediaTtsProvider } from './content-media-tts.provider';
import { initialVideoProgress } from './content-media-video.util';

export type CmktVideoGenerateInput = {
  lifecycleId: number;
  itemId: number;
  script: string;
  title: string;
  onProgress?: (progress: CmktVideoGenerationProgress) => void;
};

export type CmktVideoGenerateResult = {
  asset: CmktMediaAsset;
  progress: CmktVideoGenerationProgress;
  pipeline: {
    tts_provider: string;
    stock_provider: string;
    clip_count: number;
    audio_duration_sec: number;
  };
};

@Injectable()
export class ContentMediaVideoProvider {
  constructor(
    private readonly config: AppConfigService,
    private readonly tts: ContentMediaTtsProvider,
    private readonly stock: ContentMediaStockProvider,
    private readonly storage: ContentMediaStorageService,
  ) {}

  get providerName(): string {
    const configured = this.config.contentMarketingVideoProvider;
    return configured === 'stub' ? 'stub' : configured || 'pipeline';
  }

  async generateShortVideo(input: CmktVideoGenerateInput): Promise<CmktVideoGenerateResult> {
    if (this.providerName !== 'stub') {
      throw new Error('use_social_pipeline');
    }

    const progress = initialVideoProgress();
    const emit = (patch: Partial<CmktVideoGenerationProgress>) => {
      Object.assign(progress, patch);
      if (patch.steps) progress.steps = { ...progress.steps, ...patch.steps };
      input.onProgress?.(progress);
    };

    emit({ progress_pct: 15, steps: { script: 'done', tts: 'running' } });
    const ttsResult = await this.tts.synthesize(input.script);

    emit({ progress_pct: 45, steps: { tts: 'done', clips: 'running' }, eta_sec: 35 });
    const clips = await this.stock.fetchClips(input.script, 3);

    emit({ progress_pct: 75, steps: { clips: 'done', stitch: 'running' }, eta_sec: 15 });
    const hash = createHash('sha256')
      .update(`${input.lifecycleId}:${input.itemId}:${input.script}:${ttsResult.provider}:${clips.length}`)
      .digest('hex')
      .slice(0, 12);

    const assetId = `video-${hash}`;
    const manifest = {
      script_excerpt: input.script.slice(0, 200),
      tts: { provider: ttsResult.provider, voice: ttsResult.voice, duration_sec: ttsResult.durationSec },
      clips: clips.map((c) => ({
        id: c.id,
        url: c.url,
        keyword: c.keyword,
        duration_sec: c.duration_sec,
        provider: c.provider,
      })),
      stitched_at: new Date().toISOString(),
    };

    let videoUrl = `${this.storage.cdnBase}/video/${input.lifecycleId}/${input.itemId}/${hash}.mp4`;
    let posterUrl = `${this.storage.cdnBase}/video/${input.lifecycleId}/${input.itemId}/${hash}-poster.webp`;

    if (this.providerName !== 'stub') {
      await this.storage.uploadAsset({
        lifecycleId: input.lifecycleId,
        itemId: input.itemId,
        assetId: `${assetId}-manifest`,
        buffer: Buffer.from(JSON.stringify(manifest)),
        contentType: 'application/json',
      });
      posterUrl = clips[0]?.poster_url ?? posterUrl;
    }

    const asset: CmktMediaAsset = {
      id: assetId,
      type: 'video',
      url: videoUrl,
      poster_url: posterUrl,
      ai_generated: true,
      provider: this.providerName,
      selected: true,
      duration_sec: ttsResult.durationSec,
      prompt_hash: hash,
      draft_watermark: true,
      clean_storage_key: `${input.lifecycleId}/${input.itemId}/${assetId}-clean.mp4`,
      pipeline_json: manifest,
    };

    emit({
      progress_pct: 100,
      steps: { stitch: 'done' },
      eta_sec: 0,
    });

    return {
      asset,
      progress,
      pipeline: {
        tts_provider: ttsResult.provider,
        stock_provider: this.stock.providerName,
        clip_count: clips.length,
        audio_duration_sec: ttsResult.durationSec,
      },
    };
  }
}
