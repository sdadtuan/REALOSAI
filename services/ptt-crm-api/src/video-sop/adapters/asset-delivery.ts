import type { VdProviderCode } from './i-provider';
import { ProviderError } from './provider-error';

export type DeliverInput = {
  provider_code: VdProviderCode;
  role: 'start_frame' | 'end_frame' | 'reference' | 'source_video' | 'source_image';
  url?: string;
  buffer?: Buffer;
  contentType?: string;
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const MAX_URL_LENGTH = 2048;

const RUNWAY_ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function assertUrlLength(url: string | undefined): void {
  if (url && url.length > MAX_URL_LENGTH) {
    throw new ProviderError('input_asset', 'E_INPUT_ASSET_URL_TOO_LONG');
  }
}

export async function deliver(
  input: DeliverInput,
): Promise<{ ref: string; delivery: 'URL' | 'UPLOAD' | 'DATA_URI' }> {
  const contentType = input.contentType ?? DEFAULT_CONTENT_TYPE;

  assertUrlLength(input.url);

  switch (input.provider_code) {
    case 'runway': {
      if (
        contentType === DEFAULT_CONTENT_TYPE ||
        !RUNWAY_ALLOWED_CONTENT_TYPES.has(contentType)
      ) {
        throw new ProviderError('input_asset', 'E_INPUT_ASSET_CONTENT_TYPE');
      }
      if (!input.url) {
        throw new ProviderError('input_asset', 'E_INPUT_ASSET_URL_REQUIRED');
      }
      return { delivery: 'URL', ref: input.url };
    }
    case 'leonardo':
      return { delivery: 'UPLOAD', ref: 'init-image://pending' };
    case 'topaz':
      return { delivery: 'UPLOAD', ref: 'multipart://pending' };
    case 'kling': {
      if (!input.url?.startsWith('https://')) {
        throw new ProviderError('input_asset', 'E_INPUT_ASSET_HTTPS_REQUIRED');
      }
      return { delivery: 'URL', ref: input.url };
    }
    default:
      throw new ProviderError('input_asset', 'E_INPUT_ASSET_UNSUPPORTED_PROVIDER');
  }
}
