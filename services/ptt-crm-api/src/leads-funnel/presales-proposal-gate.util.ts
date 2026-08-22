import { validatePreliminaryPlan } from './presales-marketing-plan.util';

export interface ProposalAdvanceGate {
  ok: boolean;
  level: 'ok' | 'block';
  messages: string[];
  consult_task_done: boolean;
  consult_task_total: number;
  consult_task_done_count: number;
  marketing_plan: { ok: boolean; messages: string[] };
}

export function buildProposalAdvanceGate(input: {
  consultProgress: { total: number; done: number };
  plan: {
    name?: string | null;
    north_star?: string | null;
    objectives?: string | null;
    strategy_framework_json?: string | null;
  } | null;
}): ProposalAdvanceGate {
  const total = input.consultProgress.total;
  const done = input.consultProgress.done;
  const consultTaskDone = total === 0 || done >= total;
  const planVal = validatePreliminaryPlan(input.plan);

  const messages: string[] = [];
  if (!consultTaskDone) {
    messages.push('Hoàn thành task Consult trước khi chuyển Báo giá');
  }
  if (!planVal.ok) {
    messages.push(...planVal.messages);
  }

  return {
    ok: consultTaskDone && planVal.ok,
    level: consultTaskDone && planVal.ok ? 'ok' : 'block',
    messages,
    consult_task_done: consultTaskDone,
    consult_task_total: total,
    consult_task_done_count: done,
    marketing_plan: { ok: planVal.ok, messages: planVal.messages },
  };
}
