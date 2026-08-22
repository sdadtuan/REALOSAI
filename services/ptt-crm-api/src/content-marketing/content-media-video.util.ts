import { createHash } from 'crypto';
import type { CmktMediaAsset, CmktVideoGenerationProgress } from './content-marketing.types';

export function itemEligibleForVideoShort(item: {
  channel: string;
  format: string;
  body_json?: { markdown?: string };
}): boolean {
  if (item.format === 'video_script') return true;
  if (item.channel === 'short_video') return true;
  return false;
}

export function buildVideoShortStub(input: {
  lifecycleId: number;
  itemId: number;
  script: string;
  provider?: string;
  cdnBase?: string;
}): { asset: CmktMediaAsset; progress: CmktVideoGenerationProgress } {
  const script = input.script.trim().slice(0, 800);
  const hash = createHash('sha256').update(`${input.lifecycleId}:${input.itemId}:${script}`).digest('hex').slice(0, 12);
  const base = (input.cdnBase ?? 'https://cdn.pttads.vn/cmkt').replace(/\/$/, '');
  const provider = input.provider ?? 'stub';
  const asset: CmktMediaAsset = {
    id: `video-${hash}`,
    type: 'video',
    url: `${base}/video/${input.lifecycleId}/${input.itemId}/${hash}.mp4`,
    poster_url: `${base}/video/${input.lifecycleId}/${input.itemId}/${hash}-poster.webp`,
    ai_generated: true,
    provider,
    selected: true,
    duration_sec: 45,
    prompt_hash: hash,
  };
  const progress: CmktVideoGenerationProgress = {
    progress_pct: 100,
    steps: { script: 'done', tts: 'done', clips: 'done', stitch: 'done' },
    eta_sec: 0,
  };
  return { asset, progress };
}

export function initialVideoProgress(): CmktVideoGenerationProgress {
  return {
    progress_pct: 5,
    steps: { script: 'running', tts: 'pending', clips: 'pending', stitch: 'pending' },
    eta_sec: 55,
  };
}
