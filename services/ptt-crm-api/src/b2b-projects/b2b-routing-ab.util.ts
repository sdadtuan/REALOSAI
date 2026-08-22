import {
  decideFirstAssign,
  hybridPick,
  type DecideFirstAssignInput,
  type DecideFirstAssignResult,
} from './b2b-assign.util';
import { B2B_ASSIGN_CONFIDENCE_MIN } from './b2b-projects.constants';

export type RoutingAbBucket = 'ai_analytics' | 'hybrid';

export const ROUTING_AB_GRAY_MIN = 0.7;
export const ROUTING_AB_GRAY_MAX = 0.8;

export function assignAbBucket(leadId: number): RoutingAbBucket {
  let hash = leadId | 0;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  return (hash & 1) === 0 ? 'ai_analytics' : 'hybrid';
}

export function assignAbBucketForIngest(projectId: string, phone: string): RoutingAbBucket {
  let hash = 0;
  const seed = `${projectId}:${phone}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) & 1) === 0 ? 'ai_analytics' : 'hybrid';
}

export function decideFirstAssignWithAb(
  input: DecideFirstAssignInput & { abBucket: RoutingAbBucket },
): DecideFirstAssignResult {
  const base = decideFirstAssign(input);
  const conf = input.ml?.confidence ?? null;
  if (input.timedOut || conf == null || !input.ml) {
    return { ...base, reason: `${base.reason}; ab=${input.abBucket}` };
  }

  const inGray = conf >= ROUTING_AB_GRAY_MIN && conf < ROUTING_AB_GRAY_MAX;
  if (!inGray) {
    return { ...base, reason: `${base.reason}; ab=${input.abBucket}` };
  }

  if (input.abBucket === 'hybrid' && base.strategy === 'ai_analytics') {
    const pick = hybridPick(input.pool, input.score);
    return {
      ownerId: pick?.staffId ?? null,
      strategy: input.timedOut ? 'hybrid_timeout' : 'hybrid',
      reason: `ab_force_hybrid conf=${conf.toFixed(2)}`,
      confidence: conf,
    };
  }

  if (
    input.abBucket === 'ai_analytics' &&
    base.strategy !== 'ai_analytics' &&
    conf >= ROUTING_AB_GRAY_MIN &&
    input.pool.some((p) => p.staffId === input.ml!.staffId && !p.inCall)
  ) {
    return {
      ownerId: input.ml.staffId,
      strategy: 'ai_analytics',
      reason: `${input.ml.reason}; ab_ai_gray conf=${conf.toFixed(2)}`,
      confidence: conf,
    };
  }

  if (
    input.abBucket === 'ai_analytics' &&
    base.strategy === 'ai_analytics' &&
    conf < B2B_ASSIGN_CONFIDENCE_MIN &&
    conf >= ROUTING_AB_GRAY_MIN
  ) {
    return base;
  }

  return { ...base, reason: `${base.reason}; ab=${input.abBucket}` };
}

export function isTerminalOutcomeStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'chot' || s === 'won' || s === 'post_sale' || s === 'lost';
}

export function outcomeWonFromStatus(status: string | null | undefined): boolean | null {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'chot' || s === 'won' || s === 'post_sale') return true;
  if (s === 'lost') return false;
  return null;
}
