import {
  computeSpaMeta24hSlas,
  isSpaClosedStatus,
  parseB2CompletedAt,
} from '../cskh-board/cskh-board-sla.util';
import { inferBreachRootCause, type BreachRootCause } from '../cskh-board/cskh-manager-intelligence.util';

const ROOT_CAUSE_LABELS: Record<BreachRootCause, string> = {
  no_call: 'Chưa gọi lần đầu',
  no_b2: 'Quá 24h chưa hoàn thành B2',
  no_close: 'Quá 24h chưa chốt/lost',
  mixed: 'Nhiều bước SLA chưa đạt',
};

export interface ReviewQueueAiSummary {
  lead_id: number;
  summary_line: string;
  root_cause: BreachRootCause;
  suggested_owner_id: number | null;
  suggested_owner_name: string | null;
  suggest_reason: string;
  priority_score?: number;
  workload_note?: string;
  triage_source?: 'rules' | 'llm' | 'llm_stub';
}

/** Priority 1 (low) … 5 (critical) from review queue age. */
export function computeReviewQueuePriority(hoursWaiting: number | null | undefined): number {
  const hours = hoursWaiting ?? 0;
  if (hours >= 48) return 5;
  if (hours >= 36) return 4;
  if (hours >= 24) return 3;
  if (hours >= 12) return 2;
  return 1;
}

export function buildReviewQueueLlmPrompt(
  items: Array<{
    lead_id: number;
    full_name: string;
    status: string;
    hours_waiting: number | null;
    root_cause: BreachRootCause;
    owner_name: string | null;
    best_owner_name: string | null;
    rules_summary: string;
  }>,
): string {
  const lines = items.map((item) =>
    [
      `lead_id=${item.lead_id}`,
      `name=${item.full_name || '—'}`,
      `status=${item.status}`,
      `hours_waiting=${item.hours_waiting ?? '?'}`,
      `root_cause=${item.root_cause}`,
      `owner=${item.owner_name ?? 'none'}`,
      `best_rep=${item.best_owner_name ?? 'none'}`,
      `rules_summary=${item.rules_summary}`,
    ].join(' | '),
  );
  return lines.join('\n');
}

export function buildReviewQueueAiSummary(input: {
  leadId: number;
  fullName: string;
  status: string;
  hoursWaiting: number | null;
  firstCallAt: string | null;
  b2CompletedAt: string | null;
  ownerId: number | null;
  ownerName: string | null;
  bestOwnerId: number | null;
  bestOwnerName: string | null;
}): ReviewQueueAiSummary {
  const hours = input.hoursWaiting ?? 0;
  let root: BreachRootCause = 'no_b2';
  if (!input.firstCallAt) root = 'no_call';
  else if (!input.b2CompletedAt) root = 'no_b2';
  else root = 'no_close';

  const summaryParts = [
    `Chờ ${hours}h trong review queue`,
    ROOT_CAUSE_LABELS[root],
    input.status ? `status ${input.status}` : '',
  ].filter(Boolean);

  const suggestOwner =
    input.bestOwnerId && input.bestOwnerId !== input.ownerId
      ? { id: input.bestOwnerId, name: input.bestOwnerName }
      : null;

  return {
    lead_id: input.leadId,
    summary_line: summaryParts.join(' — '),
    root_cause: root,
    suggested_owner_id: suggestOwner?.id ?? null,
    suggested_owner_name: suggestOwner?.name ?? null,
    suggest_reason: suggestOwner
      ? `Gợi ý gán ${suggestOwner.name} (rep SLA tốt nhất hiện tại)`
      : 'Giữ owner hiện tại hoặc chọn manual',
  };
}

export function reviewQueueRootFromSla(input: {
  status: string;
  receivedAt: string | null;
  createdAt: string | null;
  firstCallAt: string | null;
  careStagesDoneJson: string | null;
}): BreachRootCause {
  const b2At = parseB2CompletedAt(input.careStagesDoneJson);
  const sla = computeSpaMeta24hSlas({
    status: input.status,
    receivedAt: input.receivedAt ?? input.createdAt,
    createdAt: input.createdAt,
    firstCallAt: input.firstCallAt,
    careStagesDoneJson: input.careStagesDoneJson,
    b2CompletedAt: b2At,
    closedAt: isSpaClosedStatus(input.status) ? new Date().toISOString() : null,
  });
  const mockRow = {
    id: 0,
    full_name: '',
    phone: '',
    email: '',
    status: input.status,
    source: '',
    channel: '',
    owner_id: null,
    owner_name: null,
    received_at: input.receivedAt ?? '',
    created_at: input.createdAt ?? '',
    first_call_at: input.firstCallAt,
    b2_completed_at: b2At,
    closed_at: null,
    sla_state: sla.sla_state,
    sla_tier: sla.sla_tier,
    sla_tiers: sla.tiers,
    sla_minutes_elapsed: sla.sla_minutes_elapsed,
    sla_deadline_at: sla.sla_deadline_at,
    next_follow_up_at: null,
  };
  return inferBreachRootCause(mockRow);
}
