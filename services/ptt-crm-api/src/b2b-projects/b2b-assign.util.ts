import { B2B_ASSIGN_CONFIDENCE_MIN } from './b2b-projects.constants';

export interface AssignPoolMember {
  staffId: number;
  salesLevel: string;
  openFirstTouch: number;
  inCall: boolean;
}

export interface DecideFirstAssignInput {
  timedOut: boolean;
  ml: { staffId: number; confidence: number; reason: string } | null;
  pool: AssignPoolMember[];
  score: number | null;
}

export interface DecideFirstAssignResult {
  ownerId: number | null;
  strategy: 'ai_analytics' | 'hybrid' | 'hybrid_timeout';
  reason: string;
  confidence: number | null;
}

export function hybridPick(pool: AssignPoolMember[], score: number | null): AssignPoolMember | null {
  const free = pool.filter((p) => !p.inCall);
  if (!free.length) return null;
  const band = score != null && score >= 70 ? 'hot' : score != null && score >= 40 ? 'warm' : 'cold';
  const levelOk = (lv: string) => {
    const l = lv.toLowerCase();
    if (band === 'hot') return l === 's' || l === 'a';
    if (band === 'warm') return l === 'a' || l === 'b';
    return l === 'b' || l === 'c';
  };
  const ranked = [...free].sort((a, b) => {
    const aFit = levelOk(a.salesLevel) ? 0 : 1;
    const bFit = levelOk(b.salesLevel) ? 0 : 1;
    if (aFit !== bFit) return aFit - bFit;
    return a.openFirstTouch - b.openFirstTouch;
  });
  return ranked[0] ?? null;
}

export function decideFirstAssign(input: DecideFirstAssignInput): DecideFirstAssignResult {
  const strategy = input.timedOut ? 'hybrid_timeout' : 'hybrid';
  if (
    !input.timedOut &&
    input.ml &&
    input.ml.confidence >= B2B_ASSIGN_CONFIDENCE_MIN &&
    input.pool.some((p) => p.staffId === input.ml!.staffId && !p.inCall)
  ) {
    return {
      ownerId: input.ml.staffId,
      strategy: 'ai_analytics',
      reason: input.ml.reason,
      confidence: input.ml.confidence,
    };
  }
  const pick = hybridPick(input.pool, input.score);
  return {
    ownerId: pick?.staffId ?? null,
    strategy,
    reason: pick ? `hybrid load=${pick.openFirstTouch}` : 'empty_pool',
    confidence: null,
  };
}
