import { KlingVideoGen } from './kling.video';
import { RunwayVideoGen } from './runway.video';
import type { VdIntent } from './i-provider';

export type VdVideoProvider = 'kling' | 'runway';

export type VdVideoGenInput = {
  imageUrl: string;
  prompt: string;
  durationSec: number;
  providerHint?: VdVideoProvider;
  model_key?: string;
  intent?: VdIntent;
  aspect_ratio?: string;
  resolution_tier?: string;
  audio_enabled?: boolean;
  guidances?: {
    start_frame?: string;
    end_frame?: string;
    image_reference?: string;
  };
};

export type VdVideoGenResult = {
  buffer: Buffer;
  provider: VdVideoProvider;
  providerId: string;
};

export type VdVideoGenEnv = {
  PTT_VD_KLING_API_KEY: string;
  PTT_VD_RUNWAY_API_KEY: string;
  PTT_VD_LEONARDO_API_KEY?: string;
};

export interface IVideoGen {
  readonly providerName: VdVideoProvider;
  enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<'running' | VdVideoGenResult>;
}

export function selectVideoGen(env: VdVideoGenEnv, hint?: VdVideoProvider): IVideoGen {
  const leonardoKey = (env.PTT_VD_LEONARDO_API_KEY ?? env.PTT_VD_KLING_API_KEY ?? '').trim();
  const runwayKey = (env.PTT_VD_RUNWAY_API_KEY ?? '').trim();

  if (hint === 'runway') {
    if (runwayKey) return new RunwayVideoGen(runwayKey);
    return new RunwayVideoGen('');
  }
  if (hint === 'kling') {
    if (leonardoKey) return new KlingVideoGen(leonardoKey, 'VIA_LEONARDO');
    return new KlingVideoGen('');
  }
  if (leonardoKey) return new KlingVideoGen(leonardoKey, 'VIA_LEONARDO');
  if (runwayKey) return new RunwayVideoGen(runwayKey);
  return new KlingVideoGen('');
}

export function videoQueueForProvider(provider: VdVideoProvider): 'q.video.kling' | 'q.video.runway' {
  return provider === 'runway' ? 'q.video.runway' : 'q.video.kling';
}

export function modelKeyForIntent(intent: VdIntent): string {
  return intent === 'DRAFT' ? 'video.runway.gen4_turbo_draft' : 'video.kling.v3.pro';
}

export function providerHintForIntent(intent: VdIntent): VdVideoProvider {
  return intent === 'DRAFT' ? 'runway' : 'kling';
}
