import { OFFICIAL_TMMT_CORE_KEYS } from '../service-lifecycle/lifecycle-marketing-plan.util';
import type { MktAiBrief, MktAiCampaignDraft, MktAiDraft } from './marketing-ai-planner.types';
import { kpiTreeIsComplete } from './marketing-ai-kpi-tree.util';

export interface QualityScoreResult {
  score: number;
  criteria: Record<string, boolean>;
  can_apply: boolean;
  can_export: boolean;
  can_export_docx_only: boolean;
}

export function computeQualityScore(
  brief: MktAiBrief | null,
  draft: MktAiDraft,
  options?: { planDepthEnabled?: boolean },
): QualityScoreResult {
  const sf = draft.strategy_framework ?? {};
  const prof = draft.target_market_prof ?? {};
  const campaigns = (draft.campaigns_json ?? []) as MktAiCampaignDraft[];

  const criteria: Record<string, boolean> = {
    brief_complete: Boolean(brief?.brand_name && brief?.challenges && brief?.budget_monthly_vnd),
    icp_clarity: String(prof.segmentation_icp ?? '').trim().length >= 80,
    budget_realistic: Number(brief?.budget_monthly_vnd ?? 0) > 0,
    kpi_defined: campaigns.some((c) => (c.kpis?.length ?? 0) > 0 || c.objective),
    channel_mix: campaigns.some((c) => (c.channel_mix?.length ?? 0) >= 2),
    risk_competitor:
      (brief?.competitors?.length ?? 0) > 0 ||
      String(prof.buy_triggers_obstacles ?? prof.insights_evidence ?? '').trim().length > 20,
  };

  if (options?.planDepthEnabled) {
    criteria.kpi_tree_complete = kpiTreeIsComplete(draft.kpi_tree_json);
  }

  const weights: Record<string, number> = {
    brief_complete: 20,
    icp_clarity: 20,
    budget_realistic: 15,
    kpi_defined: 15,
    channel_mix: 15,
    risk_competitor: 15,
    ...(options?.planDepthEnabled ? { kpi_tree_complete: 10 } : {}),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (criteria[key]) score += weight;
  }

  const coreFilled = OFFICIAL_TMMT_CORE_KEYS.every((k) => String(prof[k] ?? '').trim());
  if (coreFilled && String(sf.target_market ?? '').trim()) {
    score = Math.min(100, score + 5);
  }

  return {
    score,
    criteria,
    can_apply: score >= 60,
    can_export: score >= 60,
    can_export_docx_only: score >= 60 && score < 70,
  };
}
