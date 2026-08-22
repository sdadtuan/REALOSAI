export type VdQueue =
  | 'q.text'
  | 'q.image'
  | 'q.video.kling'
  | 'q.video.runway'
  | 'q.enhance'
  | 'q.media'
  | 'q.notify';

export type VdJobStatus =
  | 'created'
  | 'queued'
  | 'submitted'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'expired';

export type VdErrorClass =
  | 'auth'
  | 'validation'
  | 'budget'
  | 'rate_limit'
  | 'moderation'
  | 'input_asset'
  | 'capability'
  | 'transient'
  | 'timeout'
  | 'not_ready'
  | 'provider'
  | 'unknown';

export type VdJobRow = {
  id: number;
  project_id: number;
  shot_id: number | null;
  queue: VdQueue;
  job_type: string;
  status: VdJobStatus;
  error_class: string | null;
  attempt: number;
  idempotency_key: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnqueueVdJobInput = {
  projectId: number;
  queue: VdQueue;
  jobType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export type InsertVdJobInput = {
  project_id: number;
  shot_id: number | null;
  queue: VdQueue;
  job_type: string;
  status: VdJobStatus;
  error_class?: string | null;
  attempt?: number;
  idempotency_key: string;
  input_json: Record<string, unknown>;
  output_json?: Record<string, unknown>;
};

export type PatchVdJobInput = {
  status?: VdJobStatus;
  error_class?: string | null;
  attempt?: number;
  output_json?: Record<string, unknown>;
};

export const VD_QUEUES: readonly VdQueue[] = [
  'q.text',
  'q.image',
  'q.video.kling',
  'q.video.runway',
  'q.enhance',
  'q.media',
  'q.notify',
];

export function isVdQueue(value: unknown): value is VdQueue {
  return typeof value === 'string' && (VD_QUEUES as readonly string[]).includes(value);
}

export type VdJobHandler = (job: VdJobRow) => Promise<Record<string, unknown> | void>;
