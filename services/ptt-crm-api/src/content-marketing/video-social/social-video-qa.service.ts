import type { CmktVideoQaResult } from '../content-marketing.types';
import { packSpec } from '../video-kernel/video-pack.util';

export interface ScoreMasterInput {
  probe: {
    hasVideo: boolean;
    hasAudio: boolean;
    width: number;
    height: number;
    durationSec: number;
    fps?: number;
  };
  packId: string;
  hasCaptions: boolean;
  hasHookLayer: boolean;
  hasLogoOrSkipped: boolean;
  draftWatermark: boolean;
  visualApproved: boolean;
  licenseCount: number;
}

function withinTolerance(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function watermarkOk(draftWatermark: boolean, visualApproved: boolean): boolean {
  if (visualApproved) {
    return !draftWatermark;
  }
  return draftWatermark;
}

export function scoreMaster(input: ScoreMasterInput): CmktVideoQaResult {
  const spec = packSpec(input.packId);
  const { probe } = input;

  const file_ok = probe.hasVideo && probe.hasAudio;
  const duration_ok =
    probe.durationSec >= spec.minSec && probe.durationSec <= spec.maxSec;
  const aspect_ok =
    withinTolerance(probe.width, spec.width, 2) &&
    withinTolerance(probe.height, spec.height, 2);
  const caption_ok = input.hasCaptions === true;
  const license_ok = input.licenseCount > 0;
  const watermark_ok = watermarkOk(input.draftWatermark, input.visualApproved);

  const hook_text_ok = input.hasHookLayer;
  const logo_ok = input.hasLogoOrSkipped;
  const fps_ok =
    probe.fps == null || probe.fps === 0
      ? true
      : probe.fps >= 24 && probe.fps <= 30;

  const blockChecks: Record<string, boolean> = {
    file_ok,
    duration_ok,
    aspect_ok,
    caption_ok,
    license_ok,
    watermark_ok,
  };

  const warnChecks: Record<string, boolean> = {
    hook_text_ok,
    logo_ok,
    fps_ok,
  };

  const blockCount = Object.values(blockChecks).filter((ok) => !ok).length;
  const warnCount = Object.values(warnChecks).filter((ok) => !ok).length;
  const score = Math.max(0, Math.min(100, 100 - 15 * blockCount - 5 * warnCount));
  const blocked = blockCount > 0;

  return {
    score,
    blocked,
    checks: { ...blockChecks, ...warnChecks },
  };
}
