import { PRESALES_STAGES, PresalesStage } from './leads-funnel.types';
import { PresalesWorkflowStep, workflowStepsForService } from './presales-workflow-steps.util';

/** Map generic presales task keys → service-specific template keys. */
export const LEGACY_PRESALES_FIELD_MAP: Record<string, string> = {
  need_summary: 'need',
  consult_notes: 'current_status',
  proposal_notes: 'goal',
};

export interface PresalesWorkflowUpgradeStageResult {
  stage: PresalesStage;
  deleted: number;
  inserted: number;
  preserved_done: boolean;
  mapped_fields: string[];
}

export interface PresalesWorkflowUpgradePlan {
  service_slug: string;
  stages: PresalesWorkflowUpgradeStageResult[];
}

function fieldKeys(steps: PresalesWorkflowStep[]): string[] {
  return steps.flatMap((step) => (step.form_fields ?? []).map((f) => f.key));
}

export function mergeLegacyPresalesFormData(
  oldTasks: Array<{ form_data?: Record<string, unknown>; is_done?: boolean }>,
  newFieldKeys: string[],
): { form_data: Record<string, unknown>; is_done: boolean } {
  const merged: Record<string, unknown> = {};
  let anyDone = false;
  for (const task of oldTasks) {
    if (task.is_done) anyDone = true;
    const fd = task.form_data ?? {};
    for (const [key, value] of Object.entries(fd)) {
      if (value == null || String(value).trim() === '') continue;
      const target = LEGACY_PRESALES_FIELD_MAP[key] ?? key;
      if (newFieldKeys.includes(target) && merged[target] == null) {
        merged[target] = value;
      }
    }
  }
  return { form_data: merged, is_done: anyDone };
}

export function buildPresalesWorkflowUpgradePlan(
  serviceSlug: string,
  stages: PresalesStage[],
  existingTasks: Record<string, Array<{ form_data?: Record<string, unknown>; is_done?: boolean }>>,
): PresalesWorkflowUpgradePlan {
  const steps = workflowStepsForService(serviceSlug);
  const stageResults: PresalesWorkflowUpgradeStageResult[] = [];

  for (const stage of stages) {
    const stageSteps = steps[stage] ?? [];
    const oldTasks = existingTasks[stage] ?? [];
    const keys = fieldKeys(stageSteps);
    const { form_data, is_done } = mergeLegacyPresalesFormData(oldTasks, keys);
    stageResults.push({
      stage,
      deleted: oldTasks.length,
      inserted: stageSteps.length,
      preserved_done: is_done,
      mapped_fields: Object.keys(form_data),
    });
  }

  return { service_slug: serviceSlug, stages: stageResults };
}

export function normalizeUpgradeStages(stages?: string[]): PresalesStage[] {
  if (!stages?.length) return [...PRESALES_STAGES];
  const allowed = new Set<string>(PRESALES_STAGES);
  const out = stages.filter((s): s is PresalesStage => allowed.has(s));
  return out.length ? out : [...PRESALES_STAGES];
}
