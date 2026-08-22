import type { VdJobStatus } from '../jobs/vd-job.types';
import type { CanonicalRequest, IProviderAdapter } from './i-provider';
import type { IVideoGen, VdVideoGenInput, VdVideoGenResult } from './i-video-gen';
import { deliver } from './asset-delivery';
import { mapHttpToErrorClass, ProviderError } from './provider-error';

const RUNWAY_API = 'https://api.dev.runwayml.com/v1';
const DEFAULT_API_VERSION = '2024-11-06';

export type RunwayEstimateInput = {
  rate: number;
  duration_sec: number;
  min_charge?: number;
};

export function estimateRunwayCredits(input: RunwayEstimateInput): number {
  const raw = input.rate * input.duration_sec;
  const floor = input.min_charge ?? 0;
  return Math.max(raw, floor);
}

export function canCancelRunwayTask(status: string): boolean {
  return status === 'PENDING' || status === 'THROTTLED' || status === 'RUNNING';
}

export function mapRunwayPoll(body: {
  status?: string;
  output?: Array<{ url?: string }>;
  failure?: { code?: string };
}): { status: VdJobStatus; url?: string; error_class?: string } {
  const status = body.status ?? '';
  if (status === 'SUCCEEDED') {
    const url = body.output?.[0]?.url;
    if (!url) {
      return { status: 'expired', error_class: 'expired' };
    }
    return { status: 'succeeded', url };
  }
  if (status === 'FAILED') {
    const code = body.failure?.code ?? '';
    if (code.startsWith('SAFETY.INPUT')) {
      return { status: 'failed', error_class: 'moderation' };
    }
    return { status: 'failed', error_class: 'provider' };
  }
  if (status === 'CANCELLED') {
    return { status: 'cancelled' };
  }
  return { status: 'running' };
}

function useProviderStub(): boolean {
  return process.env.PTT_VD_PROVIDER_STUB === '1';
}

function stubMp4Buffer(seed: string): Buffer {
  return Buffer.from(`vd-s6-runway-stub:${seed}`, 'utf8');
}

async function runwayFetch(
  apiKey: string,
  apiVersion: string,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': apiVersion,
        'Content-Type': 'application/json',
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ProviderError('transient', 'runway_network');
  }
  if (res.ok) return res;
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: { code?: string } };
    code = body.error?.code;
  } catch {
    /* ignore */
  }
  if (code?.startsWith('SAFETY.INPUT')) {
    throw new ProviderError('moderation', code);
  }
  const retryAfterRaw = res.headers.get('retry-after');
  const retryAfterSec = retryAfterRaw ? Number(retryAfterRaw) : undefined;
  throw new ProviderError(mapHttpToErrorClass(res.status, code), `runway_${res.status}`, retryAfterSec);
}

export class RunwayVideoGen implements IVideoGen {
  readonly providerName = 'runway' as const;

  constructor(
    private readonly apiKey: string,
    private readonly apiVersion = DEFAULT_API_VERSION,
  ) {}

  private assertKey(): void {
    if (!this.apiKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
  }

  isLive(): boolean {
    return Boolean(this.apiKey.trim()) && !useProviderStub();
  }

  async enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }> {
    this.assertKey();
    if (!this.isLive()) {
      return this.enqueueStub(input);
    }
    const submitted = await this.submitRunwayTask(input);
    return { providerJobId: submitted.provider_task_id };
  }

  async poll(providerJobId: string): Promise<'running' | VdVideoGenResult> {
    this.assertKey();
    if (!this.isLive()) {
      return {
        buffer: stubMp4Buffer(providerJobId),
        provider: 'runway',
        providerId: providerJobId,
      };
    }
    const state = await this.pollRunwayTask(providerJobId);
    if (state.status === 'running') return 'running';
    if (state.status === 'succeeded' && state.url) {
      const buffer = await this.downloadOutput(state.url);
      return { buffer, provider: 'runway', providerId: providerJobId };
    }
    if (state.status === 'expired') {
      throw Object.assign(new Error('input_asset'), { error_class: 'input_asset' });
    }
    throw Object.assign(new Error(state.error_class ?? 'provider'), {
      error_class: state.error_class ?? 'provider',
    });
  }

  private async enqueueStub(input: VdVideoGenInput): Promise<{ providerJobId: string }> {
    const { createHash } = await import('crypto');
    const id = createHash('sha256')
      .update(`${input.imageUrl}:${input.prompt}:${input.durationSec}:runway`)
      .digest('hex')
      .slice(0, 16);
    return { providerJobId: `runway-${id}` };
  }

  modelForInput(input: VdVideoGenInput): { model: string; rate: number; min_charge?: number } {
    const key = input.model_key ?? '';
    if (key.includes('turbo') || input.intent === 'DRAFT') {
      return { model: 'gen4_turbo', rate: 5 };
    }
    return { model: 'gen4.5', rate: 12, min_charge: 56 };
  }

  ratioFromInput(input: VdVideoGenInput): string {
    const tier = input.resolution_tier ?? '720p';
    const aspect = input.aspect_ratio ?? '16:9';
    return `${tier}_${aspect.replace(':', 'x')}`;
  }

  async submitRunwayTask(input: VdVideoGenInput): Promise<{ provider_task_id: string }> {
    const delivered = await deliver({
      provider_code: 'runway',
      role: 'start_frame',
      url: input.imageUrl,
      contentType: 'image/jpeg',
    });
    const { model } = this.modelForInput(input);
    const body: Record<string, unknown> = {
      model,
      promptImage: delivered.ref,
      ratio: this.ratioFromInput(input),
      duration: Math.min(10, Math.max(2, input.durationSec)),
    };
    if (input.prompt.trim()) {
      body.promptText = input.prompt;
    }
    const res = await runwayFetch(this.apiKey, this.apiVersion, `${RUNWAY_API}/image_to_video`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { id?: string };
    if (!payload.id) {
      throw new ProviderError('provider', 'runway_missing_task_id');
    }
    return { provider_task_id: payload.id };
  }

  async pollRunwayTask(providerTaskId: string): Promise<{
    status: VdJobStatus;
    url?: string;
    error_class?: string;
  }> {
    const res = await runwayFetch(
      this.apiKey,
      this.apiVersion,
      `${RUNWAY_API}/tasks/${providerTaskId}`,
    );
    const body = (await res.json()) as {
      status?: string;
      output?: Array<{ url?: string }>;
      failure?: { code?: string };
    };
    return mapRunwayPoll(body);
  }

  async downloadOutput(url: string): Promise<Buffer> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new ProviderError('input_asset', 'runway_download_dead');
    }
    if (!res.ok) {
      throw new ProviderError('input_asset', 'runway_download_dead');
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async cancelRunwayTask(providerTaskId: string): Promise<{ ok: boolean }> {
    const res = await runwayFetch(
      this.apiKey,
      this.apiVersion,
      `${RUNWAY_API}/tasks/${providerTaskId}`,
    );
    const body = (await res.json()) as { status?: string };
    if (body.status === 'SUCCEEDED') {
      throw new ProviderError('capability', 'E_CANCEL_AFTER_SUCCEEDED');
    }
    if (!canCancelRunwayTask(body.status ?? '')) {
      throw new ProviderError('capability', 'E_CANCEL_NOT_ALLOWED');
    }
    await runwayFetch(this.apiKey, this.apiVersion, `${RUNWAY_API}/tasks/${providerTaskId}`, {
      method: 'DELETE',
    });
    return { ok: true };
  }
}

export function asRunwayProviderAdapter(gen: RunwayVideoGen): IProviderAdapter {
  return {
    providerName: 'runway',
    capabilities: async () => [
      {
        model_key: 'video.runway.gen45',
        capability_json: { capability: 'VIDEO_GEN', async: { poll_sec: 5, api_version: DEFAULT_API_VERSION } },
      },
      {
        model_key: 'video.runway.gen4_turbo_draft',
        capability_json: { capability: 'VIDEO_GEN', async: { poll_sec: 5, api_version: DEFAULT_API_VERSION } },
      },
    ],
    health: async () => ({ ok: gen.isLive() }),
    estimate: async (req: CanonicalRequest) => {
      const duration = typeof req.params.duration_sec === 'number' ? req.params.duration_sec : 5;
      const isTurbo =
        req.model_key.includes('turbo') || req.intent === 'DRAFT' || req.model_key.includes('draft');
      const rate = isTurbo ? 5 : 12;
      const min_charge = isTurbo ? undefined : 56;
      const credits = estimateRunwayCredits({ rate, duration_sec: duration, min_charge });
      return { credits, usd: credits * 0.01, source: 'PTT_ESTIMATED' as const };
    },
    submit: async (req: CanonicalRequest) =>
      gen.submitRunwayTask({
        imageUrl: typeof req.inputs[0]?.url === 'string' ? req.inputs[0].url : '',
        prompt: typeof req.params.prompt === 'string' ? req.params.prompt : '',
        durationSec: typeof req.params.duration_sec === 'number' ? req.params.duration_sec : 5,
        model_key: req.model_key,
        intent: req.intent,
      }),
    poll: async (providerTaskId: string) => {
      const state = await gen.pollRunwayTask(providerTaskId);
      return { status: state.status };
    },
    parseWebhook: async () => null,
    cancel: async (providerTaskId: string) => {
      await gen.cancelRunwayTask(providerTaskId);
      return { ok: true };
    },
    fetchOutputs: async (state) => {
      const polled = await gen.pollRunwayTask(state.provider_task_id);
      if (polled.url) return [{ url: polled.url }];
      throw new ProviderError('input_asset', 'runway_output_missing');
    },
  };
}
