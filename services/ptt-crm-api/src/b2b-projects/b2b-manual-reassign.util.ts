export type ManualSplitChoice = 'keep_first_touch' | 'reset_closer' | 'no_split';

export class ManualSplitRequiredError extends Error {
  readonly code = 'split_required';

  constructor(message = 'split_required') {
    super(message);
    this.name = 'ManualSplitRequiredError';
  }
}

export function assertManualSplitChoice(
  split: ManualSplitChoice | undefined | null,
): asserts split is ManualSplitChoice {
  if (!split || !['keep_first_touch', 'reset_closer', 'no_split'].includes(split)) {
    throw new ManualSplitRequiredError('split_required');
  }
}

export function resolveManualSplitCommission(input: {
  choice: ManualSplitChoice;
  projectFirstTouchPct: number;
  projectCloserPct: number;
  existingFirstTouchPct?: number | null;
  existingCloserPct?: number | null;
}): { firstTouchPct: number; closerPct: number; updateCommissionSplit: boolean } {
  if (input.choice === 'no_split') {
    return { firstTouchPct: 0, closerPct: 0, updateCommissionSplit: false };
  }
  if (input.choice === 'keep_first_touch') {
    return {
      firstTouchPct: input.existingFirstTouchPct ?? input.projectFirstTouchPct,
      closerPct: input.existingCloserPct ?? input.projectCloserPct,
      updateCommissionSplit: true,
    };
  }
  return {
    firstTouchPct: input.projectFirstTouchPct,
    closerPct: input.projectCloserPct,
    updateCommissionSplit: true,
  };
}

export function isB2bManualReassignLead(lead: {
  b2b_project_id?: string | null;
  lead_flow_kind?: string | null;
}): boolean {
  return Boolean(lead.b2b_project_id) && lead.lead_flow_kind === 'b2b_prospect';
}
