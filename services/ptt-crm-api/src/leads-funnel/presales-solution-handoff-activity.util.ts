export const SOLUTION_HANDOFF_ACTIVITY_TYPES = {
  handoff: 'solution_handoff',
  claimed: 'solution_claimed',
  released: 'solution_released',
} as const;

export type SolutionHandoffActivityType =
  (typeof SOLUTION_HANDOFF_ACTIVITY_TYPES)[keyof typeof SOLUTION_HANDOFF_ACTIVITY_TYPES];

export interface SolutionHandoffActivityInput {
  leadId: number;
  serviceSlug: string;
  actorName: string;
  amOwnerName?: string;
  solutionOwnerName?: string;
}

export function buildSolutionHandoffActivity(
  kind: SolutionHandoffActivityType,
  input: SolutionHandoffActivityInput,
): { activity_type: string; content: string; result: string; next_action: string } {
  const slug = input.serviceSlug ? ` (${input.serviceSlug})` : '';
  switch (kind) {
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff:
      return {
        activity_type: kind,
        content: `[Solution handoff] AM ${input.actorName} giao lead #${input.leadId}${slug} → Solution/MKT`,
        result: 'Handoff pending — chờ Solution nhận case',
        next_action: 'Solution: nhận case tại /crm/solution/queue',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed:
      return {
        activity_type: kind,
        content: `[Solution handoff] ${input.actorName} nhận case lead #${input.leadId}${slug}`,
        result: 'Solution đang xử lý Consult + R5',
        next_action: 'Hoàn tất Consult + KHMKT sơ bộ → Trả Sales',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.released:
      return {
        activity_type: kind,
        content: `[Solution handoff] ${input.actorName} trả Sales lead #${input.leadId}${slug} — sẵn sàng Báo giá`,
        result: 'Stage → proposal; AM tiếp tục chốt KH',
        next_action: input.amOwnerName
          ? `AM ${input.amOwnerName}: tiếp tục Proposal & gửi KH`
          : 'AM: tiếp tục Proposal trên lead',
      };
    default:
      return {
        activity_type: 'system',
        content: `Solution handoff lead #${input.leadId}`,
        result: '',
        next_action: '',
      };
  }
}
