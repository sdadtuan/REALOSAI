import { FluxReplicateImageGen } from './flux-replicate.image';
import { LeonardoImageGen } from './leonardo.image';

export type VdImageGenInput = {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  negativePrompt?: string;
  route?: 'DIRECT' | 'VIA_V1_CONTROLNETS';
  model?: string;
  guidances?: {
    character_id?: string;
    character_strength?: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA' | 'MAX';
  };
};

export type VdImageGenResult = {
  buffer: Buffer;
  provider: 'leonardo' | 'flux';
  providerId: string;
  seed: number;
  request_snapshot?: { warnings?: string[] };
};

export type VdImageGenEnv = {
  PTT_VD_LEONARDO_API_KEY: string;
  REPLICATE_API_TOKEN: string;
};

export interface IImageGen {
  readonly providerName: 'leonardo' | 'flux';
  generate(input: VdImageGenInput): Promise<VdImageGenResult>;
}

export function selectImageGen(env: VdImageGenEnv): IImageGen {
  const leonardoKey = (env.PTT_VD_LEONARDO_API_KEY ?? '').trim();
  if (leonardoKey) return new LeonardoImageGen(leonardoKey);
  const replicateToken = (env.REPLICATE_API_TOKEN ?? '').trim();
  if (replicateToken) return new FluxReplicateImageGen(replicateToken);
  throw new Error('auth');
}
