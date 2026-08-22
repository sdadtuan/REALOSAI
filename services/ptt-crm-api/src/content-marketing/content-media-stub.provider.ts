import { Injectable } from '@nestjs/common';
import type { CmktMediaImageProviderContract, CmktGeneratedImageBuffer } from './content-media-provider.interface';
import type { CmktImageGenerateInput } from './content-media-image.provider';
import { hashMediaPrompt, resolveChannelSpec } from './content-media.util';
import { renderPlaceholderImageBuffer } from './content-media-watermark.util';

@Injectable()
export class StubMediaProvider implements CmktMediaImageProviderContract {
  readonly name = 'stub';

  async generateImages(input: CmktImageGenerateInput): Promise<CmktGeneratedImageBuffer[]> {
    const spec = resolveChannelSpec(input.aspectRatio);
    const promptHash = hashMediaPrompt([
      input.title,
      input.approvedCopy.slice(0, 500),
      input.stylePreset,
      input.aspectRatio,
      String(input.variantCount),
    ]);
    const texts =
      input.assetType === 'carousel_slide' && input.slideTexts?.length
        ? input.slideTexts
        : Array.from({ length: input.variantCount }, (_, i) => `${input.title} — variant ${i + 1}`);

    const out: CmktGeneratedImageBuffer[] = [];
    for (let idx = 0; idx < texts.length; idx++) {
      const label = texts[idx];
      const buffer = await renderPlaceholderImageBuffer({
        width: spec.width,
        height: spec.height,
        title: input.title,
        subtitle: label,
        stylePreset: input.stylePreset,
        seed: hashMediaPrompt([promptHash, label, String(idx)]),
      });
      out.push({
        buffer,
        contentType: 'image/webp',
        label,
        slideIndex: input.assetType === 'carousel_slide' ? idx + 1 : undefined,
        providerRequestId: `stub-${promptHash.slice(0, 12)}-${idx}`,
      });
    }
    return out;
  }
}
