import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export type ResearchLlmJsonResult = {
  parsed: Record<string, unknown>;
  modelName: string;
};

@Injectable()
export class MarketResearchLlmService {
  private readonly logger = new Logger(MarketResearchLlmService.name);

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  modelName(): string {
    return (process.env.RESEARCH_COPILOT_MODEL ?? 'claude-sonnet-4-20250514').trim();
  }

  async completeJson(input: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<ResearchLlmJsonResult> {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException({ error: 'llm_unconfigured' });
    }
    const model = this.modelName();
    const controller = new AbortController();
    const timeoutMs = Math.max(
      1000,
      Number(process.env.RESEARCH_COPILOT_TIMEOUT_MS ?? 45000) || 45000,
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.2,
          system: input.systemPrompt,
          messages: [{ role: 'user', content: input.userPrompt }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Anthropic HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }
      const payload = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = (payload.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('')
        .trim();
      return { parsed: parseJsonObject(text), modelName: model };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({ error: 'llm_timeout' });
      }
      this.logger.warn(
        `Research copilot LLM failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private apiKey(): string {
    return String(process.env.ANTHROPIC_API_KEY ?? '').trim();
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const slice = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  const parsed = JSON.parse(slice) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_llm_json');
  }
  return parsed as Record<string, unknown>;
}
