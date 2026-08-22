import type { PlanInsightSnapshot } from './market-research.types';

export function freezePlanInsights(input: {
  client_id: string;
  insight_ids: number[];
  inserted_by: string;
  now?: string;
}): PlanInsightSnapshot {
  const ids = [...new Set(input.insight_ids.filter((n) => Number.isFinite(n) && n > 0))];
  return {
    client_id: String(input.client_id).trim(),
    insight_ids: ids,
    inserted_at: input.now ?? new Date().toISOString(),
    inserted_by: input.inserted_by,
  };
}

export function assertNoInsightTextLeak(json: unknown): void {
  const raw = JSON.stringify(json);
  if (/"statement"\s*:/.test(raw) || /"excerpt"\s*:/.test(raw)) {
    throw Object.assign(new Error('plan_must_not_copy_insight_text'), {
      code: 'plan_must_not_copy_insight_text',
    });
  }
}
