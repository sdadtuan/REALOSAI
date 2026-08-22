export type VdProbeSnapshot = {
  hasVideo: boolean;
  hasAudio: boolean;
  durationSec: number;
  lufs: number | null;
};

export type VdGate4AutoResult = {
  ok: boolean;
  blocked: boolean;
  reasons: string[];
};

const MIN_DURATION_SEC = 12;

export function evaluateGate4Auto(probe: VdProbeSnapshot): VdGate4AutoResult {
  const reasons: string[] = [];
  if (!probe.hasVideo) reasons.push('missing_video');
  if (!probe.hasAudio) reasons.push('missing_audio');
  if (probe.durationSec < MIN_DURATION_SEC) reasons.push('duration_too_short');
  const ok = reasons.length === 0;
  return {
    ok,
    blocked: !ok,
    reasons,
  };
}
