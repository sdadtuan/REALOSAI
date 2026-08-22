import type { OrchestrationPlan } from '../orchestrator.types';

/** WIN-4-C — weekly CPL digest + budget recommend orchestration. */
export const CPL_WEEKLY_PLAN = {
  key: 'cpl_weekly_v1',
  steps: [
    { key: 'channel_anomaly', required: true },
    { key: 'budget_recommend', required: false },
  ],
} as const satisfies OrchestrationPlan;
