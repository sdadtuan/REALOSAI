import type { CanonicalRequest } from './i-provider';
import { mapHttpToErrorClass, ProviderError } from './provider-error';

const TOPAZ_IMAGE = 'https://api.topazlabs.com/image/v1';

export function pickTopazDownloadUrl(
  body: { download_url?: string; url?: string },
  warn?: (message: string) => void,
): string | null {
  if (typeof body.download_url === 'string' && body.download_url.trim()) {
    return body.download_url.trim();
  }
  if (typeof body.url === 'string' && body.url.trim()) {
    warn?.('topaz_download_url_fallback');
    return body.url.trim();
  }
  return null;
}

export function mapTopazHttpStatus(status: number): ProviderError {
  if (status === 402) return new ProviderError('budget', `topaz_${status}`);
  if (status === 409 || status === 425) return new ProviderError('not_ready', `topaz_${status}`);
  return new ProviderError(mapHttpToErrorClass(status), `topaz_${status}`);
}

function useProviderStub(): boolean {
  return process.env.PTT_VD_PROVIDER_STUB === '1';
}

async function topazFetch(apiKey: string, url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'X-API-Key': apiKey,
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ProviderError('transient', 'topaz_network');
  }
  if (!res.ok) throw mapTopazHttpStatus(res.status);
  return res;
}

export class TopazEnhance {
  readonly providerName = 'topaz' as const;

  constructor(private readonly apiKey: string) {}

  private assertKey(): void {
    if (!this.apiKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
  }

  isLive(): boolean {
    return Boolean(this.apiKey.trim()) && !useProviderStub();
  }

  async enhance(inputPath: string): Promise<{
    buffer: Buffer;
    provider: 'topaz';
    providerId: string;
  }> {
    this.assertKey();
    if (!this.isLive()) {
      const { createHash } = await import('crypto');
      const providerId = createHash('sha256').update(inputPath).digest('hex').slice(0, 12);
      return {
        buffer: Buffer.from(`vd-s8-topaz-stub:${providerId}`, 'utf8'),
        provider: 'topaz',
        providerId: `topaz-${providerId}`,
      };
    }
    const submitted = await this.submitImageAsync(inputPath);
    const output = await this.pollImageUntilReady(submitted.process_id);
    const buffer = await this.downloadImage(output);
    return { buffer, provider: 'topaz', providerId: submitted.process_id };
  }

  async enhanceRequest(req: CanonicalRequest): Promise<{ provider_task_id: string }> {
    const inputPath =
      typeof req.params.input_path === 'string' ? req.params.input_path : req.inputs[0]?.url ?? '';
    const submitted = await this.submitImageAsync(inputPath);
    return { provider_task_id: submitted.process_id };
  }

  async submitImageAsync(inputPath: string): Promise<{ process_id: string }> {
    this.assertKey();
    const res = await topazFetch(this.apiKey, `${TOPAZ_IMAGE}/enhance/async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { path: inputPath } }),
    });
    const body = (await res.json()) as { process_id?: string; id?: string };
    const process_id = body.process_id ?? body.id;
    if (!process_id) throw new ProviderError('provider', 'topaz_missing_process_id');
    return { process_id };
  }

  async pollImageStatus(processId: string): Promise<{
    status: string;
    download_url?: string;
    url?: string;
    credits?: number;
  }> {
    const res = await topazFetch(this.apiKey, `${TOPAZ_IMAGE}/status/${processId}`);
    return (await res.json()) as {
      status: string;
      download_url?: string;
      url?: string;
      credits?: number;
    };
  }

  async pollImageUntilReady(processId: string): Promise<{ download_url?: string; url?: string }> {
    for (let i = 0; i < 60; i += 1) {
      const body = await this.pollImageStatus(processId);
      if (body.status === 'completed' || body.status === 'COMPLETED') {
        const picked = pickTopazDownloadUrl(body);
        if (!picked) throw new ProviderError('provider', 'topaz_missing_download');
        return body;
      }
      if (body.status === 'failed' || body.status === 'FAILED') {
        throw new ProviderError('provider', 'topaz_image_failed');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new ProviderError('timeout', 'topaz_image_timeout');
  }

  async downloadImage(body: { download_url?: string; url?: string }): Promise<Buffer> {
    const url = pickTopazDownloadUrl(body);
    if (!url) throw new ProviderError('provider', 'topaz_missing_download');
    const res = await fetch(url);
    if (!res.ok) throw new ProviderError('input_asset', 'topaz_download_failed');
    return Buffer.from(await res.arrayBuffer());
  }

  async fetchOutputs(state: {
    provider_task_id: string;
    body?: { download_url?: string; url?: string };
  }): Promise<Array<{ url: string }>> {
    const body = state.body ?? (await this.pollImageStatus(state.provider_task_id));
    const url = pickTopazDownloadUrl(body);
    if (!url) throw new ProviderError('provider', 'topaz_missing_download');
    return [{ url }];
  }
}
