import { createHash } from 'crypto';
import type { IVideoGen, VdVideoGenInput, VdVideoGenResult } from './i-video-gen';
import { LeonardoVideoGen } from './leonardo.video';

function useProviderStub(): boolean {
  return process.env.PTT_VD_PROVIDER_STUB === '1';
}

function stubMp4Buffer(seed: string): Buffer {
  return Buffer.from(`vd-s6-kling-stub:${seed}`, 'utf8');
}

export class KlingVideoGen implements IVideoGen {
  readonly providerName = 'kling' as const;
  private readonly leonardo: LeonardoVideoGen | null;

  constructor(
    private readonly leonardoKey: string,
    private readonly route: 'VIA_LEONARDO' | 'DIRECT' = 'VIA_LEONARDO',
  ) {
    this.leonardo = leonardoKey.trim() && route === 'VIA_LEONARDO' ? new LeonardoVideoGen(leonardoKey) : null;
  }

  private assertKey(): void {
    if (!this.leonardoKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
  }

  private isLive(): boolean {
    return Boolean(this.leonardoKey.trim()) && !useProviderStub() && this.leonardo != null;
  }

  async enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }> {
    this.assertKey();
    if (!this.isLive()) {
      const id = createHash('sha256')
        .update(`${input.imageUrl}:${input.prompt}:${input.durationSec}`)
        .digest('hex')
        .slice(0, 16);
      return { providerJobId: `kling-${id}` };
    }
    return this.leonardo!.submitKling(input);
  }

  async poll(providerJobId: string): Promise<'running' | VdVideoGenResult> {
    this.assertKey();
    if (!this.isLive()) {
      return {
        buffer: stubMp4Buffer(providerJobId),
        provider: 'kling',
        providerId: providerJobId,
      };
    }
    const polled = await this.leonardo!.pollKling(providerJobId);
    if (polled === 'running') return 'running';
    const buffer = await this.leonardo!.downloadVideo(polled.url);
    return { buffer, provider: 'kling', providerId: providerJobId };
  }
}
