import { PRELIMINARY_STRATEGY_KEYS } from './presales-marketing-plan.util';
import type { ProposalAdvanceGate } from './presales-proposal-gate.util';

export interface L1GateChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

const STRATEGY_LABELS: Record<string, string> = {
  market_message: 'Thông điệp thị trường (market_message)',
  media_reach: 'Kênh tiếp cận / Media (media_reach)',
  conversion_strategy: 'Chiến lược chuyển đổi (conversion_strategy)',
};

export function buildL1GateChecklist(input: {
  gate: ProposalAdvanceGate;
  plan: {
    name?: string | null;
    north_star?: string | null;
    objectives?: string | null;
    strategy_framework?: Record<string, string> | null;
  };
}): L1GateChecklistItem[] {
  const { gate, plan } = input;
  const sf = plan.strategy_framework ?? {};
  const total = gate.consult_task_total;
  const done = gate.consult_task_done_count;
  const consultLabel =
    total > 0
      ? `Task Consult hoàn tất (${done}/${total})`
      : 'Task Consult hoàn tất';

  const items: L1GateChecklistItem[] = [
    {
      key: 'consult',
      label: consultLabel,
      done: gate.consult_task_done,
    },
    {
      key: 'plan_name',
      label: 'Tên kế hoạch MKT sơ bộ',
      done: Boolean(String(plan.name ?? '').trim()),
    },
    {
      key: 'north_star_or_objectives',
      label: 'North Star hoặc Mục tiêu chiến lược',
      done:
        Boolean(String(plan.north_star ?? '').trim()) ||
        Boolean(String(plan.objectives ?? '').trim()),
    },
  ];

  for (const key of PRELIMINARY_STRATEGY_KEYS) {
    items.push({
      key,
      label: STRATEGY_LABELS[key] ?? key,
      done: Boolean(String(sf[key] ?? '').trim()),
    });
  }

  return items;
}
