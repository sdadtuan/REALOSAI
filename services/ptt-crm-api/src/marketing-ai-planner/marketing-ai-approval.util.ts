import type { MktAiApprovalStatus, MktAiBrief, MktAiDraft } from './marketing-ai-planner.types';

export type MktAiApprovalDecision = 'approved' | 'changes_requested' | 'rejected';

export function assertApprovalTransition(
  current: MktAiApprovalStatus,
  decision: MktAiApprovalDecision,
): void {
  if (current !== 'pending') {
    throw new Error(`approval_not_pending:${current}`);
  }
  if (!['approved', 'changes_requested', 'rejected'].includes(decision)) {
    throw new Error(`invalid_decision:${decision}`);
  }
}

export function versionStatusForDecision(decision: MktAiApprovalDecision): string {
  if (decision === 'approved') return 'approved';
  if (decision === 'rejected') return 'archived';
  return 'draft';
}

export function buildPlanVersionLabel(versionNo: number, custom?: string): string {
  const trimmed = String(custom ?? '').trim();
  return trimmed || `v${versionNo}`;
}

export function snapshotFromDraft(
  brief: MktAiBrief | null,
  draft: MktAiDraft,
): {
  brief_json: MktAiBrief;
  strategy_framework_json: Record<string, string>;
  target_market_prof_json: Record<string, string>;
  campaigns_json: MktAiDraft['campaigns_json'];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
} {
  return {
    brief_json: brief ?? {},
    strategy_framework_json: draft.strategy_framework ?? {},
    target_market_prof_json: draft.target_market_prof ?? {},
    campaigns_json: draft.campaigns_json ?? [],
    content_json: draft.content_json ?? {},
    quality_score_json: draft.quality_score_json ?? {},
  };
}

export function canExportWithApproval(
  approvalRequired: boolean,
  latestStatus?: MktAiApprovalStatus | null,
): boolean {
  if (!approvalRequired) return true;
  return latestStatus === 'approved';
}
