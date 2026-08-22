import type { VdJobStatus } from '../jobs/vd-job.types';
import type { IImageGen, VdImageGenInput, VdImageGenResult } from './i-image-gen';
import { providerFetch } from './provider-http';

const LEONARDO_V1 = 'https://cloud.leonardo.ai/api/rest/v1';
const LEONARDO_V2 = 'https://cloud.leonardo.ai/api/rest/v2';

export type LeonardoPollState = {
  status: VdJobStatus;
  error_class?: 'not_ready';
  url?: string;
  warnings?: string[];
};

export type LeonardoCharacterStrength = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' | 'MAX';

export function mapCharacterStrength(strength: LeonardoCharacterStrength): {
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  warning?: string;
} {
  if (strength === 'ULTRA' || strength === 'MAX') {
    return {
      strength: 'HIGH',
      warning: `character_strength_${strength}_mapped_to_HIGH`,
    };
  }
  return { strength };
}

export function mapLeonardoPoll(body: {
  generations_by_pk?: {
    status?: string;
    generated_images?: Array<{ url?: string }>;
  };
}): LeonardoPollState {
  const row = body.generations_by_pk;
  if (!row) {
    return { status: 'running', error_class: 'not_ready' };
  }
  if (row.status === 'FAILED') {
    return { status: 'failed' };
  }
  if (row.status === 'COMPLETE') {
    const images = row.generated_images ?? [];
    if (images.length === 0) {
      return { status: 'running', error_class: 'not_ready' };
    }
    const url = images[0]?.url;
    if (!url) {
      return { status: 'running', error_class: 'not_ready' };
    }
    return { status: 'succeeded', url };
  }
  return { status: 'running' };
}

export function buildLeonardoV2Body(
  input: VdImageGenInput,
  model = 'lucid-origin',
): { model: string; parameters: Record<string, unknown>; warnings: string[] } {
  const seed = Number.isFinite(input.seed) ? Number(input.seed) : 0;
  const warnings: string[] = [];
  const parameters: Record<string, unknown> = {
    prompt: input.prompt,
    width: input.width,
    height: input.height,
    seed,
    num_images: 1,
    ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
  };
  if (input.guidances?.character_strength) {
    const mapped = mapCharacterStrength(input.guidances.character_strength);
    parameters.guidances = {
      ...(input.guidances.character_id ? { character_id: input.guidances.character_id } : {}),
      character_strength: mapped.strength,
    };
    if (mapped.warning) warnings.push(mapped.warning);
  }
  return { model, parameters, warnings };
}

export class LeonardoImageGen implements IImageGen {
  readonly providerName = 'leonardo' as const;

  constructor(private readonly apiKey: string) {}

  async generate(input: VdImageGenInput): Promise<VdImageGenResult> {
    const route = input.route ?? 'DIRECT';
    const warnings: string[] = [];
    const seed = Number.isFinite(input.seed) ? Number(input.seed) : 0;
    let generationId: string;

    if (route === 'VIA_V1_CONTROLNETS') {
      generationId = await this.createGenerationV1(input, seed);
    } else {
      const built = buildLeonardoV2Body(input, input.model ?? 'lucid-origin');
      warnings.push(...built.warnings);
      generationId = await this.createGenerationV2(built.model, built.parameters);
    }

    const url = await this.pollImageUrl(generationId);
    const buffer = await downloadBuffer(url);
    return {
      buffer,
      provider: 'leonardo',
      providerId: generationId,
      seed,
      request_snapshot: warnings.length > 0 ? { warnings } : undefined,
    };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  private async createGenerationV1(input: VdImageGenInput, seed: number): Promise<string> {
    const res = await providerFetch(
      `${LEONARDO_V1}/generations`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          prompt: input.prompt,
          width: input.width,
          height: input.height,
          num_images: 1,
          seed,
          ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
        }),
      },
      'leonardo_create_failed',
    );
    const body = (await res.json()) as {
      sdGenerationJob?: { generationId?: string };
    };
    const id = body.sdGenerationJob?.generationId;
    if (!id) {
      throw Object.assign(new Error('leonardo_missing_generation_id'), { error_class: 'provider' });
    }
    return id;
  }

  private async createGenerationV2(
    model: string,
    parameters: Record<string, unknown>,
  ): Promise<string> {
    const res = await providerFetch(
      `${LEONARDO_V2}/generations`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model, parameters }),
      },
      'leonardo_create_failed',
    );
    const body = (await res.json()) as {
      generationId?: string;
      sdGenerationJob?: { generationId?: string };
    };
    const id = body.generationId ?? body.sdGenerationJob?.generationId;
    if (!id) {
      throw Object.assign(new Error('leonardo_missing_generation_id'), { error_class: 'provider' });
    }
    return id;
  }

  private async pollImageUrl(generationId: string): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await providerFetch(
        `${LEONARDO_V1}/generations/${generationId}`,
        { headers: this.headers() },
        'leonardo_poll_failed',
      );
      const body = (await res.json()) as {
        generations_by_pk?: {
          status?: string;
          generated_images?: Array<{ url?: string }>;
        };
      };
      const mapped = mapLeonardoPoll(body);
      if (mapped.status === 'succeeded' && mapped.url) {
        return mapped.url;
      }
      if (mapped.status === 'failed') {
        throw Object.assign(new Error('leonardo_generation_failed'), { error_class: 'provider' });
      }
      if (mapped.error_class === 'not_ready') {
        await sleep(1500);
        continue;
      }
      await sleep(1500);
    }
    throw Object.assign(new Error('leonardo_timeout'), { error_class: 'transient' });
  }
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await providerFetch(
    url,
    { headers: { accept: 'image/*' } },
    'leonardo_download_failed',
  );
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
