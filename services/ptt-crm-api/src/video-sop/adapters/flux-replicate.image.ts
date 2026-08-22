import type { IImageGen, VdImageGenInput, VdImageGenResult } from './i-image-gen';
import { providerFetch } from './provider-http';

const REPLICATE_API = 'https://api.replicate.com/v1';
const FLUX_MODEL = 'black-forest-labs/flux-schnell';

export class FluxReplicateImageGen implements IImageGen {
  readonly providerName = 'flux' as const;

  constructor(private readonly token: string) {}

  async generate(input: VdImageGenInput): Promise<VdImageGenResult> {
    const seed = Number.isFinite(input.seed) ? Number(input.seed) : 0;
    const created = await this.createPrediction(input, seed);
    const imageUrl = created.outputUrl ?? (await this.pollOutputUrl(created.id));
    const buffer = await downloadBuffer(imageUrl);
    return { buffer, provider: 'flux', providerId: created.id, seed };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    };
  }

  private async createPrediction(
    input: VdImageGenInput,
    seed: number,
  ): Promise<{ id: string; outputUrl: string | null }> {
    const res = await providerFetch(
      `${REPLICATE_API}/models/${FLUX_MODEL}/predictions`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          input: {
            prompt: input.prompt,
            width: input.width,
            height: input.height,
            seed,
            num_outputs: 1,
            ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
          },
        }),
      },
      'flux_create_failed',
    );
    const body = (await res.json()) as { id?: string; error?: string; output?: unknown };
    if (!body.id) throw Object.assign(new Error('flux_missing_prediction_id'), { error_class: 'provider' });
    return { id: body.id, outputUrl: firstUrl(body.output) };
  }

  private async pollOutputUrl(predictionId: string): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await providerFetch(
        `${REPLICATE_API}/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
        'flux_poll_failed',
      );
      const body = (await res.json()) as {
        status?: string;
        output?: unknown;
        error?: string;
      };
      if (body.status === 'succeeded') {
        const url = firstUrl(body.output);
        if (!url) throw Object.assign(new Error('flux_missing_output_url'), { error_class: 'provider' });
        return url;
      }
      if (body.status === 'failed' || body.status === 'canceled') {
        throw Object.assign(new Error(body.error ?? `flux_${body.status}`), { error_class: 'provider' });
      }
      await sleep(1500);
    }
    throw Object.assign(new Error('flux_timeout'), { error_class: 'transient' });
  }
}

function firstUrl(output: unknown): string | null {
  if (typeof output === 'string' && output) return output;
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0]) return output[0];
  return null;
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await providerFetch(url, undefined, 'flux_download_failed');
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
