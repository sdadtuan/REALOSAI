import type { IntakeSessionRow } from '../intake/intake.types';
import { buildConsultBrief } from '../service-lifecycle/lifecycle-consult.util';
import type { PresalesTaskRow } from './leads-funnel.types';

export function buildPresalesConsultBrief(input: {
  presalesId: number;
  leadId: number;
  serviceSlug: string;
  presalesStage: string;
  leadTaskDone: boolean;
  leadTask: PresalesTaskRow | null;
  intakeSessions: IntakeSessionRow[];
}): Record<string, unknown> {
  const leadTask = input.leadTask
    ? {
        task_id: input.leadTask.id,
        form_data: input.leadTask.form_data ?? {},
        notes: input.leadTask.notes ?? '',
        is_done: input.leadTask.is_done,
      }
    : null;

  const brief = buildConsultBrief({
    lifecycleId: 0,
    serviceSlug: input.serviceSlug,
    leadId: input.leadId,
    leadTaskDone: input.leadTaskDone,
    leadTask,
    intakeSessions: input.intakeSessions,
  });

  return {
    ...brief,
    presales_id: input.presalesId,
    presales_stage: input.presalesStage,
  };
}
