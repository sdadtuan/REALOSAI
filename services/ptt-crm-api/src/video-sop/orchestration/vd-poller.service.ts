import { Injectable } from '@nestjs/common';

const DEFAULT_POLL_SEC: Record<string, number> = {
  'text.openai': 2,
  'video.runway': 5,
  'video.kling': 10,
  'image.leonardo': 10,
  'enhance.leonardo': 10,
};

export function pollSecFor(model_key: string, capability_json?: Record<string, unknown>): number {
  const asyncCfg = capability_json?.async as { poll_sec?: number } | undefined;
  if (typeof asyncCfg?.poll_sec === 'number' && asyncCfg.poll_sec > 0) {
    return asyncCfg.poll_sec;
  }
  for (const [prefix, sec] of Object.entries(DEFAULT_POLL_SEC)) {
    if (model_key.startsWith(prefix)) return sec;
  }
  return 10;
}

export function jitteredPollDelayMs(pollSec: number, random = Math.random): number {
  return Math.floor(pollSec * 1000 * (1 + random() * 0.5));
}

/** S13: registry poll cadence helpers; dispatcher drain remains setImmediate-driven. */
@Injectable()
export class VdPollerService {
  pollSecFor = pollSecFor;
  jitteredPollDelayMs = jitteredPollDelayMs;

  tick(): void {
    /* S2/S13: async jobs retry via dispatcher backoff using pollSecFor */
  }
}
