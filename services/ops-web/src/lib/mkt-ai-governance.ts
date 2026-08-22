import type { MktAiPlannerContext } from '@/lib/mkt-ai-planner-api';

export interface MktAiGovernanceBannerProps {
  playbookLabel?: string | null;
  governanceNotes?: string[];
  qualityScore?: number | null;
  minScore?: number;
  gateOk?: boolean;
  gateRequired?: boolean;
  gateMessage?: string;
  applyLinkHref?: string;
  launchQaLinkHref?: string;
}

export function buildMktAiGovernanceBannerProps(
  ctx: MktAiPlannerContext | null | undefined,
  opts: { lifecycleId?: number; includeLinks?: boolean } = {},
): MktAiGovernanceBannerProps | null {
  if (!ctx?.flags.playbook_governance_enabled) return null;

  const lifecycleId = opts.lifecycleId;
  const includeLinks = opts.includeLinks !== false && lifecycleId != null;
  const base = `/crm/service-delivery/${lifecycleId}`;

  return {
    playbookLabel: ctx.playbook?.label_vi ?? null,
    governanceNotes: ctx.playbook?.governance_notes ?? [],
    qualityScore: ctx.launch_qa_quality_gate?.current_score ?? ctx.quality_score?.score ?? null,
    minScore:
      ctx.launch_qa_quality_gate?.min_score ??
      ctx.playbook?.quality_gate.min_score_launch_qa ??
      70,
    gateOk: ctx.launch_qa_quality_gate?.ok ?? true,
    gateRequired: ctx.launch_qa_quality_gate?.required ?? false,
    gateMessage: ctx.launch_qa_quality_gate?.message_vi,
    applyLinkHref: includeLinks ? `${base}?tab=ai-planner&step=apply` : undefined,
    launchQaLinkHref: includeLinks ? `${base}?tab=launch_qa` : undefined,
  };
}
