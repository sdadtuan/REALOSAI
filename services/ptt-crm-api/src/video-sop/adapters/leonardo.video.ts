import type { VdVideoGenInput } from './i-video-gen';
import { ProviderError } from './provider-error';

const LEONARDO_V1 = 'https://cloud.leonardo.ai/api/rest/v1';
const LEONARDO_V2 = 'https://cloud.leonardo.ai/api/rest/v2';

export function assertKlingViaLeonardoInput(input: VdVideoGenInput): void {
  if (input.durationSec < 3 || input.durationSec > 15) {
    throw new ProviderError('capability', 'E_DURATION_OUT_OF_RANGE');
  }
  if (input.prompt.length > 1500) {
    throw new ProviderError('capability', 'E_PROMPT_TOO_LONG');
  }
  const g = input.guidances;
  if (g?.end_frame && !g?.start_frame) {
    throw new ProviderError('capability', 'E_END_FRAME_REQUIRES_START');
  }
  if (g?.end_frame && g?.image_reference) {
    throw new ProviderError('capability', 'E_IMAGE_REF_WITH_END_FRAME');
  }
}

export function buildLeonardoKlingBody(input: VdVideoGenInput, model = 'kling-3.0'): {
  model: string;
  parameters: Record<string, unknown>;
} {
  assertKlingViaLeonardoInput(input);
  const parameters: Record<string, unknown> = {
    prompt: input.prompt,
    duration: input.durationSec,
  };
  if (input.guidances?.start_frame || input.guidances?.end_frame) {
    parameters.guidances = {
      ...(input.guidances.start_frame ? { start_frame: input.guidances.start_frame } : {}),
      ...(input.guidances.end_frame ? { end_frame: input.guidances.end_frame } : {}),
    };
  }
  if (input.audio_enabled === true) {
    parameters.enable_audio = true;
    parameters.motion_has_audio = true;
  }
  return { model, parameters };
}

export function mapLeonardoVideoPoll(body: {
  generations_by_pk?: {
    status?: string;
    generated_images?: Array<{ url?: string }>;
  };
}): 'running' | { url: string } {
  const row = body.generations_by_pk;
  if (!row || row.status !== 'COMPLETE') {
    return 'running';
  }
  const images = row.generated_images ?? [];
  if (images.length === 0) {
    throw Object.assign(new Error('not_ready'), { error_class: 'not_ready' });
  }
  const url = images[0]?.url;
  if (!url) {
    throw Object.assign(new Error('not_ready'), { error_class: 'not_ready' });
  }
  return { url };
}

export class LeonardoVideoGen {
  constructor(private readonly apiKey: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  async submitKling(input: VdVideoGenInput): Promise<{ providerJobId: string }> {
    const body = buildLeonardoKlingBody(input, input.model_key?.includes('kling') ? 'kling-3.0' : 'kling-3.0');
    const res = await fetch(`${LEONARDO_V2}/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw Object.assign(new Error(`leonardo_video_${res.status}`), {
        error_class: res.status === 401 ? 'auth' : 'provider',
      });
    }
    const payload = (await res.json()) as {
      generationId?: string;
      sdGenerationJob?: { generationId?: string };
    };
    const id = payload.generationId ?? payload.sdGenerationJob?.generationId;
    if (!id) {
      throw Object.assign(new Error('leonardo_missing_generation_id'), { error_class: 'provider' });
    }
    return { providerJobId: id };
  }

  async pollKling(providerJobId: string): Promise<'running' | { url: string }> {
    const res = await fetch(`${LEONARDO_V1}/generations/${providerJobId}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw Object.assign(new Error(`leonardo_poll_${res.status}`), { error_class: 'provider' });
    }
    const body = (await res.json()) as {
      generations_by_pk?: {
        status?: string;
        generated_images?: Array<{ url?: string }>;
      };
    };
    return mapLeonardoVideoPoll(body);
  }

  async downloadVideo(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw Object.assign(new Error('leonardo_download_failed'), { error_class: 'input_asset' });
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
