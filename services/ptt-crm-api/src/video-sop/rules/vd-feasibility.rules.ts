export type VdShotDraft = {
  duration_ms: number;
  text_in_frame: boolean;
  contains_human: boolean | unknown;
  aspect: string;
  camera: string;
  action: string;
  logo_in_ai_frame: boolean;
  seed: number | null;
  status: string;
};

export type VdFeasibilityRow = { id: string; ok: boolean };

export type VdFeasibilityProject = { duration_sec: number; platform: string };

const ALLOWED_ASPECTS = new Set(['9:16', '1:1']);
const ALLOWED_PLATFORMS = new Set(['reels', 'shorts', 'feed_square']);
const SINGLE_SHOT_RULE_IDS = new Set([
  'FR-R01',
  'FR-R02',
  'FR-R03',
  'FR-R04',
  'FR-R06',
  'FR-R07',
  'FR-R08',
]);

export const PER_SHOT_RULE_IDS = SINGLE_SHOT_RULE_IDS;

function isMin3(value: unknown): boolean {
  return typeof value === 'string' && value.length >= 3;
}

export function evaluateFeasibility(
  project: VdFeasibilityProject,
  shots: VdShotDraft[],
): VdFeasibilityRow[] {
  return [
    { id: 'FR-R01', ok: !shots.some((shot) => shot.duration_ms > 15000) },
    { id: 'FR-R02', ok: !shots.some((shot) => shot.text_in_frame === true) },
    { id: 'FR-R03', ok: !shots.some((shot) => typeof shot.contains_human !== 'boolean') },
    { id: 'FR-R04', ok: !shots.some((shot) => !ALLOWED_ASPECTS.has(shot.aspect)) },
    { id: 'FR-R05', ok: shots.length >= 3 && shots.length <= 12 },
    { id: 'FR-R06', ok: !shots.some((shot) => !isMin3(shot.camera) || !isMin3(shot.action)) },
    { id: 'FR-R07', ok: !shots.some((shot) => shot.logo_in_ai_frame === true) },
    {
      id: 'FR-R08',
      ok: !shots.some((shot) => shot.status === 'keyframe_approved' && shot.seed == null),
    },
    { id: 'FR-R09', ok: project.duration_sec >= 15 && project.duration_sec <= 60 },
    { id: 'FR-R10', ok: ALLOWED_PLATFORMS.has(project.platform) },
  ];
}

export function assertFeasibilityPass(
  project: VdFeasibilityProject,
  shots: VdShotDraft[],
): void {
  if (evaluateFeasibility(project, shots).some((row) => !row.ok)) {
    throw new Error('feasibility_blocked');
  }
}

export function assertShotFeasibility(shot: VdShotDraft): void {
  const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [shot]);
  if (rows.some((row) => SINGLE_SHOT_RULE_IDS.has(row.id) && !row.ok)) {
    throw new Error('feasibility_blocked');
  }
}
