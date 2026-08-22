import type { VdJobStatus } from '../jobs/vd-job.types';
import type { CanonicalRequest, IProviderAdapter } from './i-provider';
import type { ITextGen } from './i-text-gen';
import { mapHttpToErrorClass, ProviderError } from './provider-error';
import { providerFetch } from './provider-http';
import {
  assertVideoScriptSchema,
  parseVideoScript,
  VIDEO_SCRIPT_SCHEMA,
} from './video-script.schema';

const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES = 'https://api.openai.com/v1/responses';

export type OpenAiResponseBody = {
  model: string;
  input: string;
  background: boolean;
  store: boolean;
  text: {
    format: {
      type: 'json_schema';
      strict: true;
      name: 'video_script';
      schema: Record<string, unknown>;
    };
  };
};

export function buildOpenAiResponseBody(input: {
  prompt: string;
  model: string;
  schema: Record<string, unknown>;
}): OpenAiResponseBody {
  assertVideoScriptSchema(input.schema);
  return {
    model: input.model,
    input: input.prompt,
    background: true,
    store: true,
    text: {
      format: {
        type: 'json_schema',
        strict: true,
        name: 'video_script',
        schema: input.schema,
      },
    },
  };
}

export function mapOpenAiHttpError(
  status: number,
  code?: string,
  retryAfterSec?: number,
): ProviderError {
  const error_class = mapHttpToErrorClass(status, code);
  return new ProviderError(error_class, `openai_http_${status}`, retryAfterSec);
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readOpenAiError(res: Response): Promise<{ code?: string; retryAfterSec?: number }> {
  const retryAfterSec = parseRetryAfter(res);
  try {
    const body = (await res.json()) as { error?: { code?: string } };
    return { code: body.error?.code, retryAfterSec };
  } catch {
    return { retryAfterSec };
  }
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  for (const item of output) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object' || Array.isArray(part)) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim()) return text;
    }
  }
  throw Object.assign(new Error('validation'), { error_class: 'validation' });
}

export class OpenAITextGen implements ITextGen, IProviderAdapter {
  readonly providerName = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel = 'gpt-5.6',
  ) {}

  async complete(input: {
    system: string;
    user: string;
    mode?: 'ideas' | 'video_script';
  }): Promise<unknown> {
    if (input.mode === 'ideas' || input.user === 'ideas') {
      return this.completeIdeasChat(input);
    }
    return this.completeVideoScriptResponses(input);
  }

  private async completeIdeasChat(input: { system: string; user: string }): Promise<unknown> {
    const res = await providerFetch(
      OPENAI_CHAT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        }),
      },
      'openai_text_failed',
    );
    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
  }

  private async completeVideoScriptResponses(input: {
    system: string;
    user: string;
  }): Promise<unknown> {
    const prompt = `${input.system}\n\n${input.user}`;
    const body = buildOpenAiResponseBody({
      prompt,
      model: this.defaultModel,
      schema: VIDEO_SCRIPT_SCHEMA as unknown as Record<string, unknown>,
    });
    const res = await this.openAiFetch(OPENAI_RESPONSES, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    const text = extractResponseText(payload);
    try {
      return parseVideoScript(JSON.parse(text) as unknown);
    } catch (err) {
      if (err instanceof Error && err.message === 'validation') throw err;
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
  }

  private async openAiFetch(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw mapOpenAiHttpError(503);
    }
    if (res.ok) return res;
    const { code, retryAfterSec } = await readOpenAiError(res);
    throw mapOpenAiHttpError(res.status, code, retryAfterSec);
  }

  async capabilities(): Promise<{ model_key: string; capability_json: Record<string, unknown> }[]> {
    return [
      {
        model_key: 'text.openai.script',
        capability_json: {
          capability: 'TEXT_GEN',
          provider_model_id: this.defaultModel,
        },
      },
    ];
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: Boolean(this.apiKey.trim()) };
  }

  async estimate(_req: CanonicalRequest): Promise<{ credits: number; usd: number; source: 'PTT_ESTIMATED' }> {
    return { credits: 0, usd: 0, source: 'PTT_ESTIMATED' };
  }

  async submit(req: CanonicalRequest): Promise<{ provider_task_id: string }> {
    if (req.params.mode === 'ideas') {
      throw new ProviderError('capability', 'E_IDEAS_USE_COMPLETE');
    }
    const prompt =
      typeof req.params.prompt === 'string' && req.params.prompt.trim()
        ? req.params.prompt
        : 'Generate video script';
    const model =
      typeof req.params.provider_model_id === 'string'
        ? req.params.provider_model_id
        : this.defaultModel;
    const body = buildOpenAiResponseBody({
      prompt,
      model,
      schema: VIDEO_SCRIPT_SCHEMA as unknown as Record<string, unknown>,
    });
    const res = await this.openAiFetch(OPENAI_RESPONSES, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { id?: string };
    if (!payload.id) {
      throw new ProviderError('provider', 'openai_missing_response_id');
    }
    return { provider_task_id: payload.id };
  }

  async poll(providerTaskId: string): Promise<{ status: VdJobStatus; progress?: number }> {
    const res = await this.openAiFetch(`${OPENAI_RESPONSES}/${providerTaskId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const payload = (await res.json()) as { status?: string };
    if (payload.status === 'completed') return { status: 'succeeded' };
    if (payload.status === 'failed') return { status: 'failed' };
    if (payload.status === 'cancelled') return { status: 'cancelled' };
    return { status: 'running' };
  }

  async parseWebhook(
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ status: VdJobStatus; event_id: string } | null> {
    const secret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
    if (secret) {
      const webhookId = headers['webhook-id'] ?? headers['Webhook-Id'];
      const signature = headers['webhook-signature'] ?? headers['Webhook-Signature'];
      if (!webhookId || !signature) {
        throw new ProviderError('auth', 'openai_webhook_sig');
      }
    } else {
      const internal = headers['x-ptt-internal-key'] ?? headers['X-Ptt-Internal-Key'];
      const expected = process.env.PTT_CRM_INTERNAL_KEY?.trim();
      if (expected && internal !== expected) {
        throw new ProviderError('auth', 'openai_webhook_internal');
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const eventId = (body as { id?: unknown }).id;
    const statusRaw = (body as { data?: { status?: unknown } }).data?.status;
    if (typeof eventId !== 'string' || !eventId.trim()) return null;
    const status: VdJobStatus =
      statusRaw === 'completed'
        ? 'succeeded'
        : statusRaw === 'failed'
          ? 'failed'
          : 'running';
    return { status, event_id: eventId };
  }

  async cancel(providerTaskId: string): Promise<{ ok: boolean; creditsKept?: number }> {
    await this.openAiFetch(`${OPENAI_RESPONSES}/${providerTaskId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return { ok: true };
  }

  async fetchOutputs(state: {
    provider_task_id: string;
  }): Promise<Array<{ url: string; sha256?: string }>> {
    const res = await this.openAiFetch(`${OPENAI_RESPONSES}/${state.provider_task_id}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const payload = await res.json();
    const text = extractResponseText(payload);
    parseVideoScript(JSON.parse(text) as unknown);
    return [{ url: `data:application/json,${encodeURIComponent(text)}` }];
  }
}
