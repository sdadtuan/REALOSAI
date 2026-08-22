import type { OrchestrationPlan } from '../orchestrator.types';

export const RETAIN_HEALTH_CLIENT_PLAN = {
  key: 'retain_health_client_v1',
  steps: [
    { key: 'upsell_suggest', required: false },
    { key: 'channel_anomaly', required: false },
  ],
} as const satisfies OrchestrationPlan;
