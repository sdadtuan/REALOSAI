import type { VdJobStatus } from '../jobs/vd-job.types';
import { ProviderError } from './provider-error';

export type VdCapability =
  | 'TEXT_GEN'
  | 'IMAGE_GEN'
  | 'VIDEO_GEN'
  | 'ENHANCE_IMAGE'
  | 'ENHANCE_VIDEO';

export type VdIntent = 'DRAFT' | 'FINAL';

export type VdProviderCode =
  | 'openai'
  | 'leonardo'
  | 'kling'
  | 'runway'
  | 'topaz'
  | 'flux'
  | 'ffmpeg';

export type CanonicalRequest = {
  job_id: string;
  project_id: number;
  shot_id: number | null;
  capability: VdCapability;
  provider_code: VdProviderCode;
  model_key: string;
  intent: VdIntent;
  params: Record<string, unknown>;
  inputs: Array<{
    role: string;
    asset_id?: number;
    url?: string;
    delivery?: 'URL' | 'UPLOAD' | 'DATA_URI';
  }>;
  budget?: { max_credits?: number; max_usd?: number };
  callback?: { mode: 'WEBHOOK' | 'POLL'; url?: string };
  meta?: { requested_by?: string; sop_gate?: string; attempt?: number };
};

export type VdModelRegistryRow = {
  code: string;
  capability_json: Record<string, unknown>;
};

export interface IProviderAdapter {
  readonly providerName: string;
  capabilities(): Promise<{ model_key: string; capability_json: Record<string, unknown> }[]>;
  health(): Promise<{ ok: boolean }>;
  estimate(req: CanonicalRequest): Promise<{ credits: number; usd: number; source: 'PTT_ESTIMATED' }>;
  submit(req: CanonicalRequest): Promise<{ provider_task_id: string }>;
  poll(providerTaskId: string): Promise<{ status: VdJobStatus; progress?: number }>;
  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ status: VdJobStatus; event_id: string } | null>;
  cancel(providerTaskId: string): Promise<{ ok: boolean; creditsKept?: number }>;
  fetchOutputs(state: {
    provider_task_id: string;
    urls?: string[];
  }): Promise<Array<{ url: string; sha256?: string }>>;
}

export function getModel(
  registry: VdModelRegistryRow[],
  model_key: string,
): VdModelRegistryRow {
  const row = registry.find((entry) => entry.code === model_key);
  if (!row) {
    throw new ProviderError('capability', 'E_MODEL_NOT_FOUND');
  }
  if (row.capability_json.status === 'DISABLED') {
    throw new ProviderError('capability', 'E_MODEL_DISABLED');
  }
  return row;
}
