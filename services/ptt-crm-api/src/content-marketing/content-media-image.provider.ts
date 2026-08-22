import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import type { CmktMediaAsset } from './content-marketing.types';
import { hashMediaPrompt } from './content-media.util';
import { ContentMediaAssetCacheService } from './content-media-asset-cache.service';
import { ReplicateMediaProvider } from './content-media-replicate.provider';
import { StubMediaProvider } from './content-media-stub.provider';
import { ContentMediaStorageService } from './content-media-storage.service';
import { applyDraftWatermarkToBuffer } from './content-media-watermark.util';
import type { CmktMediaImageProviderContract } from './content-media-provider.interface';
import {
  analyzeImageBuffer,
  extractBrandPalette,
  scoreFromImageAnalysis,
} from './content-visual-qa.util';

export type CmktImageGenerateInput = {
  lifecycleId: number;
  itemId: number;
  variantCount: number;
  aspectRatio: string;
  stylePreset: string;
  title: string;
  approvedCopy: string;
  draftWatermark: boolean;
  slideTexts?: string[];
  assetType?: 'image' | 'carousel_slide';
  brandContext?: Record<string, unknown>;
};

export type CmktGeneratedImageBundle = {
  assets: CmktMediaAsset[];
  qa: {
    score: number;
    checks: Record<string, boolean>;
    blocked: boolean;
    brand_delta_e_max: number | null;
    ocr_confidence: number;
  };
};

@Injectable()
export class ContentMediaImageProvider {
  constructor(
    private readonly config: AppConfigService,
    private readonly storage: ContentMediaStorageService,
    private readonly cache: ContentMediaAssetCacheService,
    private readonly stub: StubMediaProvider,
    private readonly replicate: ReplicateMediaProvider,
  ) {}

  get providerName(): string {
    return this.resolveProvider().name;
  }

  private resolveProvider(): CmktMediaImageProviderContract {
    const configured = this.config.contentMarketingImageProvider;
    if (configured === 'replicate' && this.config.replicateApiToken) {
      return this.replicate;
    }
    return this.stub;
  }

  async generateImages(input: CmktImageGenerateInput): Promise<CmktGeneratedImageBundle> {
    const provider = this.resolveProvider();
    const promptHash = hashMediaPrompt([
      input.title,
      input.approvedCopy.slice(0, 500),
      input.stylePreset,
      input.aspectRatio,
      String(input.variantCount),
      provider.name,
    ]);
    const palette = extractBrandPalette(input.brandContext ?? {});

    const generated = await provider.generateImages(input);
    const assets: CmktMediaAsset[] = [];
    let bestAnalysis: Awaited<ReturnType<typeof analyzeImageBuffer>> | null = null;

    for (let idx = 0; idx < generated.length; idx++) {
      const row = generated[idx];
      const assetId = randomUUID();
      const cleanBuffer = row.buffer;
      this.cache.putCleanBuffer(input.lifecycleId, input.itemId, assetId, cleanBuffer);

      const expectedText = row.slideIndex != null ? input.slideTexts?.[row.slideIndex] ?? input.title : input.title;
      const analysis = await analyzeImageBuffer(cleanBuffer, {
        palette: palette.colors,
        expectedText,
      });
      if (!bestAnalysis || (analysis.ocr_confidence ?? 0) > (bestAnalysis.ocr_confidence ?? 0)) {
        bestAnalysis = analysis;
      }

      const cleanUploaded = await this.storage.uploadAsset({
        lifecycleId: input.lifecycleId,
        itemId: input.itemId,
        assetId: `${assetId}-clean`,
        buffer: cleanBuffer,
        contentType: row.contentType,
      });

      let displayBuffer = cleanBuffer;
      if (input.draftWatermark) {
        displayBuffer = await applyDraftWatermarkToBuffer(cleanBuffer, true);
      }
      const draftUploaded = await this.storage.uploadAsset({
        lifecycleId: input.lifecycleId,
        itemId: input.itemId,
        assetId,
        buffer: displayBuffer,
        contentType: row.contentType,
      });

      assets.push({
        id: assetId,
        type: input.assetType ?? 'image',
        url: draftUploaded.url,
        ai_generated: true,
        provider: provider.name,
        selected: idx === 0,
        draft_watermark: input.draftWatermark,
        slide_index: row.slideIndex,
        prompt_hash: promptHash,
        provider_request_id: row.providerRequestId,
        storage_key: draftUploaded.storageKey,
        clean_storage_key: cleanUploaded.storageKey,
        ocr_confidence: analysis.ocr_confidence,
        brand_delta_e: analysis.brand_delta_e_max ?? undefined,
        visual_qa_score: Math.round(
          Math.max(0, Math.min(100, 80 - (analysis.brand_delta_e_max ?? 0) / 3 + analysis.ocr_confidence * 10)),
        ),
      });
    }

    const baseChecks = {
      assets_present: assets.length > 0,
      dimensions_ok: true,
      channel_spec: true,
      policy_ok: true,
      safe_zone: true,
      no_draft_on_approved: false,
    };
    const scored = scoreFromImageAnalysis(bestAnalysis ?? {
      brand_delta_e_max: null,
      brand_delta_e_avg: null,
      ocr_confidence: 0.5,
      contrast_ratio: 4,
      dominant_hex: null,
    }, baseChecks);

    return {
      assets,
      qa: {
        score: scored.score,
        checks: scored.checks,
        blocked: scored.blocked,
        brand_delta_e_max: bestAnalysis?.brand_delta_e_max ?? null,
        ocr_confidence: bestAnalysis?.ocr_confidence ?? 0.5,
      },
    };
  }
}
