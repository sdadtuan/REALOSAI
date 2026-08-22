import type { CmktImageGenerateInput } from './content-media-image.provider';

export type CmktGeneratedImageBuffer = {
  buffer: Buffer;
  contentType: string;
  label: string;
  slideIndex?: number;
  providerRequestId?: string;
};

export type CmktMediaImageProviderContract = {
  readonly name: string;
  generateImages(input: CmktImageGenerateInput): Promise<CmktGeneratedImageBuffer[]>;
};
