import { TopazEnhance } from './topaz.enhance';
import type { CanonicalRequest } from './i-provider';

export type VdEnhanceResult = {
  buffer: Buffer;
  provider: 'topaz';
  providerId: string;
  skipped?: boolean;
};

export interface IEnhance {
  readonly providerName: 'topaz';
  enhance(inputPath: string): Promise<VdEnhanceResult>;
  enhanceRequest?(req: CanonicalRequest): Promise<{ provider_task_id: string }>;
}

export function selectEnhance(): IEnhance {
  const key = (process.env.PTT_VD_TOPAZ_API_KEY ?? '').trim();
  return new TopazEnhance(key);
}
