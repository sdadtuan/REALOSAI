import type { IntakeSessionRow } from '../intake/intake.types';
import { prefillConsultTaskForm } from '../service-lifecycle/lifecycle-consult.util';
import type { SvcTaskRow } from '../service-lifecycle/lifecycle-tasks.repository';
import type { PresalesTaskRow } from './leads-funnel.types';
import { applyLmpDvCodesToConsultPrefill } from '../lead-meeting-prep/lmp-consult-merge.util';

function asSvcTaskRow(task: PresalesTaskRow): SvcTaskRow {
  return {
    id: task.id,
    lifecycle_id: 0,
    stage: task.stage,
    step_index: task.step_index,
    title: task.title,
    description: task.description,
    form_fields: (task.form_fields ?? []) as SvcTaskRow['form_fields'],
    form_data: task.form_data ?? {},
    ai_prompt_key: '',
    ai_output: '',
    is_done: task.is_done,
    done_at: task.done_at,
    done_by: null,
    notes: task.notes ?? '',
    is_custom: false,
    created_at: '',
    updated_at: '',
  };
}

export function pickLatestCompletedIntake(sessions: IntakeSessionRow[]): IntakeSessionRow | null {
  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) return null;
  return completed.reduce((best, s) => {
    const bestKey = `${best.completed_at ?? ''}\0${best.id}`;
    const sKey = `${s.completed_at ?? ''}\0${s.id}`;
    return sKey > bestKey ? s : best;
  });
}

export function prefillPresalesConsultTaskForm(input: {
  serviceSlug: string;
  consultTask: PresalesTaskRow;
  leadTask: PresalesTaskRow | null;
  latestIntake: IntakeSessionRow | null;
  overwrite?: boolean;
  recommendedDvCodes?: string[];
}) {
  const base = prefillConsultTaskForm({
    serviceSlug: input.serviceSlug,
    consultTask: asSvcTaskRow(input.consultTask),
    leadTask: input.leadTask ? asSvcTaskRow(input.leadTask) : null,
    latestIntake: input.latestIntake,
    overwrite: Boolean(input.overwrite),
  });
  if (!input.recommendedDvCodes?.length) return base;
  const lmpApplied = applyLmpDvCodesToConsultPrefill(
    base.form_data,
    input.recommendedDvCodes,
    input.consultTask.form_fields ?? [],
    Boolean(input.overwrite),
  );
  return {
    ...base,
    form_data: lmpApplied.form_data,
    filled: [...new Set([...base.filled, ...lmpApplied.filled])].sort(),
  };
}
