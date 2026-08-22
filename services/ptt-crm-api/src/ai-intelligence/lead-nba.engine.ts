import { LeadScoreContext } from './lead-score.types';

export interface LeadNbaEngineResult {
  stalledDays: number;
  isStalled: boolean;
  confidence: number;
}

function daysSince(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/** AI-UC-011 — rules v1 for lead stall NBA on copilot. */
export function computeLeadNbaV1(
  ctx: LeadScoreContext,
  opts: { lastActivityAt?: Date | null; leadScore?: number | null; now?: Date },
): LeadNbaEngineResult {
  const now = opts.now ?? new Date();
  const lastTouch = opts.lastActivityAt ?? ctx.firstContactAt;
  const reference = lastTouch ?? ctx.receivedAt;
  const stalledDays = daysSince(reference, now);

  const noContactEver = !ctx.firstContactAt;
  const isStalled = noContactEver ? stalledDays >= 3 : stalledDays >= 7;

  let confidence = 0.62;
  if (opts.leadScore != null && opts.leadScore >= 70) confidence += 0.12;
  if (ctx.timelineEventCount > 0) confidence += 0.05;
  if (ctx.channel) confidence += 0.05;

  return {
    stalledDays,
    isStalled,
    confidence: Math.min(0.92, confidence),
  };
}
