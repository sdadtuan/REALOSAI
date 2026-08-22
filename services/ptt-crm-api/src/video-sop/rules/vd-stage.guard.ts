export type VdProjectStage =
  | 'brief_draft' | 'brief_ready' | 'ideation' | 'scripting' | 'shotlist_ready'
  | 'keyframing' | 'animating' | 'post_production' | 'delivered' | 'archived';

export type GateStatus = 'pending' | 'approved' | 'rejected';

export type StageGuardContext = {
  gate1?: GateStatus;
  gate2?: GateStatus;
  gate3?: GateStatus;
  gate4?: GateStatus;
};

const ALLOWED: ReadonlyArray<readonly [VdProjectStage, VdProjectStage]> = [
  ['brief_draft', 'brief_ready'],
  ['brief_ready', 'ideation'],
  ['brief_ready', 'scripting'],
  ['ideation', 'scripting'],
  ['scripting', 'shotlist_ready'],
  ['shotlist_ready', 'keyframing'],
  ['keyframing', 'animating'],
  ['animating', 'post_production'],
  ['post_production', 'delivered'],
];

function gateRequirement(
  from: VdProjectStage,
  to: VdProjectStage,
): keyof StageGuardContext | null {
  if (from === 'shotlist_ready' && to === 'keyframing') return 'gate1';
  if (from === 'keyframing' && to === 'animating') return 'gate2';
  if (from === 'animating' && to === 'post_production') return 'gate3';
  if (from === 'post_production' && to === 'delivered') return 'gate4';
  return null;
}

export function assertStageTransition(
  from: VdProjectStage,
  to: VdProjectStage,
  ctx: StageGuardContext = {},
): void {
  if (from === to) return;
  if (!ALLOWED.some(([a, b]) => a === from && b === to)) {
    throw new Error('stage_guard');
  }
  const gateKey = gateRequirement(from, to);
  if (gateKey && ctx[gateKey] !== 'approved') {
    throw new Error('stage_guard');
  }
}
