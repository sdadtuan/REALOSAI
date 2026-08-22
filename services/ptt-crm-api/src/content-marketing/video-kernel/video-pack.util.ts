export const SOCIAL_PACKS = {
  reels: { w: 1080, h: 1920, min: 12, max: 60 },
  shorts: { w: 1080, h: 1920, min: 12, max: 60 },
  feed_square: { w: 1080, h: 1080, min: 12, max: 45 },
} as const;

export type SocialPackId = keyof typeof SOCIAL_PACKS;

export interface PackSpec {
  id: SocialPackId;
  width: number;
  height: number;
  minSec: number;
  maxSec: number;
}

export function packSpec(id: string): PackSpec {
  const raw = SOCIAL_PACKS[id as SocialPackId];
  if (raw == null) {
    throw new Error('pack_not_in_v1');
  }
  return {
    id: id as SocialPackId,
    width: raw.w,
    height: raw.h,
    minSec: raw.min,
    maxSec: raw.max,
  };
}
