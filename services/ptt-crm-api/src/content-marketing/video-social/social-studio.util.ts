import type { CmktMediaJson } from '../content-marketing.types';

export type CmktVideoStudio = 'social' | 'cinematic';

const PACK_MAX_SEC: Record<string, number> = {
  reels: 60,
  shorts: 60,
  feed_square: 45,
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function rawVoDurationSec(text: string): number {
  return Math.round(countWords(text) / 2.5);
}

export function estimateVoDurationSec(text: string): number {
  const raw = rawVoDurationSec(text);
  return Math.min(60, raw);
}

export function assertScriptFitsPack(text: string, packId: string): void {
  const maxSec = PACK_MAX_SEC[packId];
  if (maxSec == null) {
    return;
  }
  if (rawVoDurationSec(text) > maxSec) {
    throw new Error('script_too_long');
  }
}

export function lockVideoStudio(
  media: CmktMediaJson,
  studio: CmktVideoStudio,
): CmktMediaJson {
  return {
    ...media,
    video_studio: studio,
    studio_locked_at: new Date().toISOString(),
  };
}

export function assertStudioWritable(
  media: CmktMediaJson,
  next: CmktVideoStudio,
): void {
  if (media.studio_locked_at && media.video_studio && next !== media.video_studio) {
    throw new Error('studio_locked');
  }
}

/** Stub TTS writes ~11 ASCII bytes (`ID3` + hash). Real MP3/WAV is much larger. */
export function isLikelyPlayableAudio(buf: Buffer): boolean {
  return buf.length >= 256;
}

/** Default transcode / requested_packs for social video (V1). */
export function defaultSocialTranscodePacks(
  channel: string | undefined,
  packDefault?: string,
  explicit?: unknown,
): string[] {
  if (channel === 'youtube') return ['shorts'];
  if (channel === 'facebook') {
    if (Array.isArray(explicit) && explicit.some((p) => String(p) === 'feed_square')) {
      return ['feed_square'];
    }
    if (packDefault === 'feed_square') return ['feed_square'];
    return [];
  }
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((p) => String(p));
  }
  if (packDefault === 'feed_square') return ['feed_square'];
  return ['reels'];
}
