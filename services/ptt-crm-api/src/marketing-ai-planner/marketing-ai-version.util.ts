import { OFFICIAL_TMMT_CORE_KEYS } from '../service-lifecycle/lifecycle-marketing-plan.util';
import { STRATEGY_FRAMEWORK_KEYS } from './marketing-ai-prompts';
import type { MktAiDraft, MktAiPlanVersionRow, MktAiPlanVersionStatus } from './marketing-ai-planner.types';

export function versionToDraft(version: MktAiPlanVersionRow, keepSwot?: Record<string, unknown>): MktAiDraft {
  return {
    strategy_framework: { ...(version.strategy_framework_json ?? {}) },
    target_market_prof: { ...(version.target_market_prof_json ?? {}) },
    campaigns_json: [...(version.campaigns_json ?? [])],
    content_json: { ...(version.content_json ?? {}) },
    quality_score_json: { ...(version.quality_score_json ?? {}) },
    swot_json: keepSwot ?? {},
  };
}

export function countTmmtFieldChanges(
  leftSf: Record<string, string>,
  leftProf: Record<string, string>,
  rightSf: Record<string, string>,
  rightProf: Record<string, string>,
): number {
  let changed = 0;
  for (const key of STRATEGY_FRAMEWORK_KEYS) {
    if (String(leftSf[key] ?? '').trim() !== String(rightSf[key] ?? '').trim()) changed++;
  }
  for (const key of OFFICIAL_TMMT_CORE_KEYS) {
    if (String(leftProf[key] ?? '').trim() !== String(rightProf[key] ?? '').trim()) changed++;
  }
  return changed;
}

export function summarizePlanVersion(version: MktAiPlanVersionRow): {
  id: number;
  version_no: number;
  label: string;
  status: MktAiPlanVersionStatus;
  created_by: string;
  created_at: string;
  quality_score: number | null;
  campaign_count: number;
} {
  const scoreRaw = version.quality_score_json?.score;
  const qualityScore =
    scoreRaw != null && Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : null;
  return {
    id: version.id,
    version_no: version.version_no,
    label: version.label,
    status: version.status,
    created_by: version.created_by,
    created_at: version.created_at,
    quality_score: qualityScore,
    campaign_count: version.campaigns_json?.length ?? 0,
  };
}
