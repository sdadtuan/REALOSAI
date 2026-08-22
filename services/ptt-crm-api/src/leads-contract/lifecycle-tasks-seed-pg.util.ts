import type { PoolClient } from 'pg';
import {
  lifecycleStepsForService,
  POST_ONBOARD_STAGES,
  RECURRING_DELIVER_SLUGS,
  type LifecycleStageKey,
  type WorkflowStep,
} from './lifecycle-workflow-steps.util';

async function insertTask(
  client: PoolClient,
  lifecycleId: number,
  stage: string,
  stepIndex: number,
  step: WorkflowStep,
  ts: string,
): Promise<void> {
  await client.query(
    `INSERT INTO crm_svc_tasks
       (lifecycle_id, stage, step_index, title, description, form_fields, form_data,
        ai_prompt_key, ai_output, is_done, done_at, done_by, notes, is_custom, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, '{}'::jsonb, $7, '', FALSE, NULL, NULL, '', FALSE, $8::timestamptz, $8::timestamptz)`,
    [
      lifecycleId,
      stage,
      stepIndex,
      step.title,
      step.description,
      JSON.stringify(step.form_fields ?? []),
      step.ai_prompt_key ?? '',
      ts,
    ],
  );
}

async function seedDeliverSteps(
  client: PoolClient,
  lifecycleId: number,
  serviceSlug: string,
  steps: WorkflowStep[],
  ts: string,
): Promise<number> {
  let count = 0;
  if (RECURRING_DELIVER_SLUGS.has(serviceSlug)) {
    for (let month = 1; month <= 12; month += 1) {
      const base = steps[0];
      if (!base) break;
      await insertTask(
        client,
        lifecycleId,
        'deliver',
        month - 1,
        {
          ...base,
          title: `${base.title} — Tháng ${month}`,
        },
        ts,
      );
      count += 1;
    }
    return count;
  }
  for (let idx = 0; idx < steps.length; idx += 1) {
    await insertTask(client, lifecycleId, 'deliver', idx, steps[idx], ts);
    count += 1;
  }
  return count;
}

/** Seed onboard/deliver/handover/retain — only stages with zero non-custom tasks. */
export async function seedPostOnboardLifecycleTasks(
  client: PoolClient,
  lifecycleId: number,
  serviceSlug: string,
  ts: string,
): Promise<number> {
  const steps = lifecycleStepsForService(serviceSlug);
  let added = 0;
  for (const stage of POST_ONBOARD_STAGES) {
    const existing = await client.query(
      `SELECT COUNT(*)::int AS c FROM crm_svc_tasks
       WHERE lifecycle_id = $1 AND stage = $2 AND is_custom = FALSE`,
      [lifecycleId, stage],
    );
    if (Number(existing.rows[0]?.c ?? 0) > 0) continue;
    const stageSteps = steps[stage as LifecycleStageKey] ?? [];
    if (stage === 'deliver') {
      added += await seedDeliverSteps(client, lifecycleId, serviceSlug, stageSteps, ts);
    } else {
      for (let idx = 0; idx < stageSteps.length; idx += 1) {
        await insertTask(client, lifecycleId, stage, idx, stageSteps[idx], ts);
        added += 1;
      }
    }
  }
  return added;
}
