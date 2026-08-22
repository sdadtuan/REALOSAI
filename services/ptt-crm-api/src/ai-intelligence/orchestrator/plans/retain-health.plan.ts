import type { OrchestrationPlan } from '../orchestrator.types';

export const RETAIN_HEALTH_PLAN = {
  key: 'retain_health_renewal_v1',
  steps: [{ key: 'renewal_scan', required: true }],
} as const satisfies OrchestrationPlan;
