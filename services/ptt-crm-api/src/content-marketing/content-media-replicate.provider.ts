import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import type { CmktMediaImageProviderContract, CmktGeneratedImageBuffer } from './content-media-provider.interface';
import type { CmktImageGenerateInput } from './content-media-image.provider';
import { hashMediaPrompt, resolveChannelSpec } from './content-media.util';
import { renderPlaceholderImageBuffer } from './content-media-watermark.util';

@Injectable()
export class ReplicateMediaProvider implements CmktMediaImageProviderContract {
  readonly name = 'replicate';
  private readonly logger = new Logger(ReplicateMediaProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async generateImages(input: CmktImageGenerateInput): Promise<CmktGeneratedImageBuffer[]> {
    const token = this.config.replicateApiToken;
    if (!token) {
      throw new Error('replicate_token_missing');
    }

    const spec = resolveChannelSpec(input.aspectRatio);
    const prompt = [
      input.stylePreset,
      input.title,
      input.approvedCopy.slice(0, 400),
    ]
      .filter(Boolean)
      .join(' · ');
    const texts =
      input.assetType === 'carousel_slide' && input.slideTexts?.length
        ? input.slideTexts
        : Array.from({ length: input.variantCount }, (_, i) => `${input.title} — variant ${i + 1}`);

    const out: CmktGeneratedImageBuffer[] = [];
    for (let idx = 0; idx < texts.length; idx++) {
      const slidePrompt = `${prompt} — ${texts[idx]}`;
      const prediction = await this.createPrediction(token, slidePrompt, spec.width, spec.height);
      const imageUrl =
        prediction.outputUrl ?? (await this.waitForOutput(token, prediction.id));
      let buffer: Buffer;
      if (imageUrl) {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`replicate_download_failed:${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        this.logger.warn(`Replicate prediction ${prediction.id} empty — fallback placeholder`);
        buffer = await renderPlaceholderImageBuffer({
          width: spec.width,
          height: spec.height,
          title: input.title,
          subtitle: texts[idx],
          stylePreset: input.stylePreset,
          seed: hashMediaPrompt([slidePrompt, String(idx)]),
        });
      }
      out.push({
        buffer,
        contentType: 'image/webp',
        label: texts[idx],
        slideIndex: input.assetType === 'carousel_slide' ? idx + 1 : undefined,
        providerRequestId: prediction.id,
      });
    }
    return out;
  }

  private async createPrediction(
    token: string,
    prompt: string,
    width: number,
    height: number,
  ): Promise<{ id: string; outputUrl: string | null }> {
    const model = this.config.contentMarketingImageModel;
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: model.includes('/') ? undefined : model,
        model: model.includes('/') ? model : undefined,
        input: {
          prompt,
          width: Math.min(width, 1440),
          height: Math.min(height, 1440),
          num_outputs: 1,
        },
      }),
    });
    const body = (await res.json()) as { id?: string; error?: string; output?: unknown };
    if (!res.ok) {
      throw new Error(body.error ?? `replicate_create_failed:${res.status}`);
    }
    if (!body.id) throw new Error('replicate_missing_prediction_id');
    const output = body.output;
    if (output) {
      const url = Array.isArray(output) ? output[0] : output;
      return {
        id: body.id,
        outputUrl: typeof url === 'string' ? url : null,
      };
    }
    return { id: body.id, outputUrl: null };
  }

  private async waitForOutput(token: string, predictionId: string): Promise<string | null> {
    for (let attempt = 0; attempt < 30; attempt++) {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        status?: string;
        output?: string | string[] | null;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `replicate_poll_failed:${res.status}`);
      if (body.status === 'succeeded') {
        const output = body.output;
        if (Array.isArray(output)) return output[0] ?? null;
        if (typeof output === 'string') return output;
        return null;
      }
      if (body.status === 'failed' || body.status === 'canceled') {
        throw new Error(body.error ?? `replicate_${body.status}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('replicate_timeout');
  }
}
