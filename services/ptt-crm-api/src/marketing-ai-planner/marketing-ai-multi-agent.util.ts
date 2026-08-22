import type { MktAiJobType } from './marketing-ai-planner.types';

export type MktAiPipelineStep = 'strategist' | 'planner' | 'copywriter' | 'analyst';

export const DEFAULT_PIPELINE_KEY = 'default_v1' as const;

export const DEFAULT_PIPELINE_STEPS: MktAiPipelineStep[] = [
  'strategist',
  'planner',
  'copywriter',
  'analyst',
];

export const STEP_TO_JOB_TYPE: Record<MktAiPipelineStep, MktAiJobType> = {
  strategist: 'strategy_generate',
  planner: 'campaign_generate',
  copywriter: 'content_generate',
  analyst: 'quality_score',
};

export const STEP_LABELS_VI: Record<MktAiPipelineStep, string> = {
  strategist: 'Strategist',
  planner: 'Planner',
  copywriter: 'Copywriter',
  analyst: 'Analyst',
};

export type MktAiMultiAgentChildStatus = 'succeeded' | 'failed' | 'skipped';

export interface MktAiMultiAgentChildJobRef {
  step: MktAiPipelineStep;
  job_type: MktAiJobType;
  job_id: number;
  status: MktAiMultiAgentChildStatus;
  latency_ms?: number;
  error_message?: string;
}

export interface MktAiMultiAgentOutput {
  pipeline_key: string;
  playbook_slug: string | null;
  child_jobs: MktAiMultiAgentChildJobRef[];
  failed_step?: MktAiPipelineStep;
  quality_score?: number;
}

const VALID_STEPS = new Set<string>(DEFAULT_PIPELINE_STEPS);

export function isPipelineStep(value: string): value is MktAiPipelineStep {
  return VALID_STEPS.has(value);
}

export function resolvePipelineSteps(input: {
  steps?: string[];
  skip_analyst?: boolean;
  start_from_step?: string;
}): MktAiPipelineStep[] {
  let steps: MktAiPipelineStep[];
  if (input.steps?.length) {
    steps = input.steps.filter(isPipelineStep);
    if (!steps.length) {
      steps = [...DEFAULT_PIPELINE_STEPS];
    }
  } else {
    steps = [...DEFAULT_PIPELINE_STEPS];
  }

  if (input.skip_analyst) {
    steps = steps.filter((s) => s !== 'analyst');
  }

  if (input.start_from_step && isPipelineStep(input.start_from_step)) {
    const idx = steps.indexOf(input.start_from_step);
    if (idx >= 0) steps = steps.slice(idx);
  }

  return steps;
}

export function rollupMultiAgentStatus(
  childJobs: MktAiMultiAgentChildJobRef[],
): 'succeeded' | 'partial' | 'failed' {
  if (!childJobs.length) return 'failed';
  const failed = childJobs.filter((j) => j.status === 'failed');
  const succeeded = childJobs.filter((j) => j.status === 'succeeded');
  if (failed.length === 0 && succeeded.length === childJobs.length) return 'succeeded';
  if (failed.length > 0 && succeeded.length > 0) return 'partial';
  return 'failed';
}

export function buildPipelineStepStates(args: {
  requestedSteps: MktAiPipelineStep[];
  childJobs: MktAiMultiAgentChildJobRef[];
  parentStatus?: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
}): Array<{
  step: MktAiPipelineStep;
  label_vi: string;
  job_type: MktAiJobType;
  state: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  job_id?: number;
}> {
  type StepState = {
    step: MktAiPipelineStep;
    label_vi: string;
    job_type: MktAiJobType;
    state: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
    job_id?: number;
  };

  const byStep = new Map(args.childJobs.map((j) => [j.step, j]));
  const states: StepState[] = args.requestedSteps.map((step) => {
    const child = byStep.get(step);
    if (!child) {
      return {
        step,
        label_vi: STEP_LABELS_VI[step],
        job_type: STEP_TO_JOB_TYPE[step],
        state: 'pending',
      };
    }
    return {
      step,
      label_vi: STEP_LABELS_VI[step],
      job_type: STEP_TO_JOB_TYPE[step],
      state: child.status === 'skipped' ? 'skipped' : child.status,
      job_id: child.job_id,
    };
  });

  if (args.parentStatus === 'running' || args.parentStatus === 'pending') {
    const runningIdx = states.findIndex((s) => s.state === 'pending');
    if (runningIdx >= 0) {
      states[runningIdx] = { ...states[runningIdx], state: 'running' };
    }
  }

  return states;
}

export function computeMultiAgentProgress(args: {
  requestedSteps: MktAiPipelineStep[];
  childJobs: MktAiMultiAgentChildJobRef[];
  parentStatus?: string;
}): { progress_pct: number; current_step: MktAiPipelineStep | null } {
  const total = args.requestedSteps.length || 1;
  const terminal = args.childJobs.filter((j) => j.status === 'succeeded' || j.status === 'failed').length;
  let progress_pct = Math.round((terminal / total) * 100);
  if (
    (args.parentStatus === 'running' || args.parentStatus === 'pending') &&
    terminal < total
  ) {
    progress_pct = Math.min(99, Math.round(((terminal + 0.5) / total) * 100));
  }
  if (args.parentStatus === 'succeeded' || args.parentStatus === 'failed') {
    progress_pct = 100;
  }
  const steps = buildPipelineStepStates({
    requestedSteps: args.requestedSteps,
    childJobs: args.childJobs,
    parentStatus: args.parentStatus as 'pending' | 'running' | undefined,
  });
  const current = steps.find((s) => s.state === 'running')?.step ?? null;
  return { progress_pct, current_step: current };
}

export function findLatestMultiAgentParentJob<
  T extends { job_type: string; status: string; output_json?: Record<string, unknown> },
>(jobs: T[]): T | null {
  return jobs.find((j) => j.job_type === 'multi_agent') ?? null;
}

export function parseMultiAgentOutput(raw: Record<string, unknown> | null | undefined): MktAiMultiAgentOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const childJobs = Array.isArray(raw.child_jobs) ? raw.child_jobs : [];
  return {
    pipeline_key: String(raw.pipeline_key ?? DEFAULT_PIPELINE_KEY),
    playbook_slug: raw.playbook_slug == null ? null : String(raw.playbook_slug),
    child_jobs: childJobs
      .map((row) => {
        const item = row as Record<string, unknown>;
        const step = String(item.step ?? '');
        if (!isPipelineStep(step)) return null;
        const status = String(item.status ?? 'failed');
        if (status !== 'succeeded' && status !== 'failed' && status !== 'skipped') return null;
        return {
          step,
          job_type: STEP_TO_JOB_TYPE[step],
          job_id: Number(item.job_id),
          status,
          latency_ms: item.latency_ms == null ? undefined : Number(item.latency_ms),
          error_message: item.error_message == null ? undefined : String(item.error_message),
        } satisfies MktAiMultiAgentChildJobRef;
      })
      .filter(Boolean) as MktAiMultiAgentChildJobRef[],
    failed_step: raw.failed_step && isPipelineStep(String(raw.failed_step))
      ? (String(raw.failed_step) as MktAiPipelineStep)
      : undefined,
    quality_score: raw.quality_score == null ? undefined : Number(raw.quality_score),
  };
}
