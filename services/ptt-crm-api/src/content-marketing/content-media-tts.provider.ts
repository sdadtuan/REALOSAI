import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AppConfigService } from '../config/app-config.service';

export type CmktTtsResult = {
  audioBuffer: Buffer;
  provider: string;
  durationSec: number;
  voice: string;
};

@Injectable()
export class ContentMediaTtsProvider {
  private readonly logger = new Logger(ContentMediaTtsProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  get providerName(): string {
    return this.config.contentMarketingTtsProvider || 'stub';
  }

  async synthesize(script: string): Promise<CmktTtsResult> {
    const text = script.trim().slice(0, 4096);
    const provider = this.providerName;
    if (provider === 'openai' && this.aiConfig.llmApiKey) {
      try {
        const voice = this.config.contentMarketingTtsVoice || 'alloy';
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.aiConfig.llmApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text.slice(0, 4096),
            voice,
            response_format: 'mp3',
          }),
        });
        if (response.ok) {
          const audioBuffer = Buffer.from(await response.arrayBuffer());
          const words = text.split(/\s+/).filter(Boolean).length;
          return {
            audioBuffer,
            provider: 'openai',
            durationSec: Math.min(60, Math.max(8, Math.round(words / 2.4))),
            voice,
          };
        }
        this.logger.warn(`OpenAI TTS failed: ${response.status}`);
      } catch (err) {
        this.logger.warn(`OpenAI TTS error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return this.buildStub(text, provider);
  }

  private buildStub(text: string, provider: string): CmktTtsResult {
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 8);
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      audioBuffer: Buffer.from(`ID3${hash}`, 'utf8'),
      provider: provider === 'openai' ? 'stub' : provider,
      durationSec: Math.min(60, Math.max(8, Math.round(words / 2.4))),
      voice: 'stub',
    };
  }
}
