import type { OrchestrationPlan } from '../orchestrator.types';

export const LEAD_INTAKE_PLAN = {
  key: 'lead_intake_v1',
  steps: [
    { key: 'score_lead', required: true },
    { key: 'route_rep', required: false, when: (ctx) => (ctx.leadScore ?? 0) >= 40 },
  ],
} as const satisfies OrchestrationPlan;
