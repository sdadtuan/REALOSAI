import type { VdMediaProbe } from './i-media-ops';
import { ProviderError } from './provider-error';

const TOPAZ_VIDEO = 'https://api.topazlabs.com/video/v1';

export type TopazSagaPart = { partNum: number; eTag: string };
export type TopazSagaState = {
  step: number;
  request_id?: string;
  parts: TopazSagaPart[];
};

export type TopazVideoPartPlan = { partNum: number; uploadUrl: string; body: Buffer };

export function partsPendingUpload(
  saga: TopazSagaState,
  plan: TopazVideoPartPlan[],
): TopazVideoPartPlan[] {
  const done = new Set(saga.parts.map((p) => p.partNum));
  return plan.filter((part) => !done.has(part.partNum));
}

export function mergeUploadedPart(
  saga: TopazSagaState,
  partNum: number,
  eTag: string,
): TopazSagaState {
  const parts = saga.parts.filter((p) => p.partNum !== partNum);
  parts.push({ partNum, eTag });
  parts.sort((a, b) => a.partNum - b.partNum);
  return { ...saga, parts, step: Math.max(saga.step, 3) };
}

export function topazCancelCreditsKept(progressPct: number): number {
  const clamped = Math.min(100, Math.max(0, progressPct));
  return 1.1 * clamped;
}

export function probeToTopazMetadata(probe: VdMediaProbe): Record<string, unknown> {
  return {
    duration: probe.durationSec,
    frameRate: 30,
    frameCount: Math.max(1, Math.round(probe.durationSec * 30)),
    resolution: '1920x1080',
  };
}

export type TopazVideoDeps = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  uploadPart?: (url: string, body: Buffer) => Promise<{ eTag: string }>;
  useS3Dest?: boolean;
};

export class TopazVideoGen {
  constructor(private readonly deps: TopazVideoDeps) {}

  private fetch(url: string, init?: RequestInit): Promise<Response> {
    const impl = this.deps.fetchImpl ?? fetch;
    return impl(url, {
      ...init,
      headers: {
        'X-API-Key': this.deps.apiKey,
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  async runSaga(input: {
    inputPath: string;
    probe: VdMediaProbe;
    saga: TopazSagaState;
    partsPlan: TopazVideoPartPlan[];
  }): Promise<TopazSagaState> {
    let saga = { ...input.saga, parts: [...input.saga.parts] };

    if (saga.step < 1) {
      const res = await this.fetch(`${TOPAZ_VIDEO}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: input.inputPath,
          metadata: probeToTopazMetadata(input.probe),
          ...(this.deps.useS3Dest ? { destination: { external: true } } : {}),
        }),
      });
      if (!res.ok) throw new ProviderError('provider', `topaz_video_estimate_${res.status}`);
      const body = (await res.json()) as { request_id?: string; id?: string };
      saga = { ...saga, step: 1, request_id: body.request_id ?? body.id };
    }

    if (!saga.request_id) throw new ProviderError('provider', 'topaz_missing_request_id');

    if (saga.step < 2) {
      const res = await this.fetch(`${TOPAZ_VIDEO}/${saga.request_id}/accept`, { method: 'PATCH' });
      if (!res.ok) throw new ProviderError('provider', `topaz_video_accept_${res.status}`);
      saga = { ...saga, step: 2 };
    }

    if (saga.step < 4) {
      const pending = partsPendingUpload(saga, input.partsPlan);
      for (const part of pending) {
        const upload = this.deps.uploadPart ?? defaultUploadPart;
        const uploaded = await upload(part.uploadUrl, part.body);
        saga = mergeUploadedPart(saga, part.partNum, uploaded.eTag);
      }
      saga = { ...saga, step: 4 };
    }

    if (saga.step < 5) {
      const res = await this.fetch(`${TOPAZ_VIDEO}/${saga.request_id}/complete-upload/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadResults: saga.parts.map((p) => ({ partNum: p.partNum, eTag: p.eTag })),
        }),
      });
      if (!res.ok) throw new ProviderError('provider', `topaz_video_complete_${res.status}`);
      saga = { ...saga, step: 5 };
    }

    return saga;
  }

  async pollStatus(requestId: string): Promise<{
    status: string;
    progress?: number;
    credits?: number;
    estimates?: { cost?: number };
  }> {
    const res = await this.fetch(`${TOPAZ_VIDEO}/${requestId}/status`);
    if (!res.ok) throw new ProviderError('provider', `topaz_video_status_${res.status}`);
    return (await res.json()) as {
      status: string;
      progress?: number;
      credits?: number;
      estimates?: { cost?: number };
    };
  }

  async cancel(requestId: string, progressPct: number): Promise<{ ok: boolean; creditsKept: number }> {
    const res = await this.fetch(`${TOPAZ_VIDEO}/${requestId}`, { method: 'DELETE' });
    if (!res.ok) throw new ProviderError('provider', `topaz_video_cancel_${res.status}`);
    return { ok: true, creditsKept: topazCancelCreditsKept(progressPct) };
  }
}

async function defaultUploadPart(url: string, body: Buffer): Promise<{ eTag: string }> {
  const res = await fetch(url, { method: 'PUT', body: new Uint8Array(body) });
  if (!res.ok) throw new ProviderError('provider', 'topaz_part_upload_failed');
  const eTag = res.headers.get('etag') ?? res.headers.get('ETag') ?? `"part-${body.length}"`;
  return { eTag };
}
