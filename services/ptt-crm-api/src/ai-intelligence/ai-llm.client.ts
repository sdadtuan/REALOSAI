import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AI_AUDIT_ERROR } from './ai-audit.constants';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiTokenUsage } from './ai-intelligence.types';
import { SummarizeContext } from './summarize.types';
import { validateSummarizeOutput } from './summarize.schema';
import { validateFollowUpDraftOutput, FollowUpDraftEngineResult } from './follow-up-draft.schema';
import { FollowUpChannelHint } from './recommendation.types';
import {
  buildNbaLlmStub,
  parseNbaLlmOutput,
  type NbaLlmSuggestion,
} from './lead-nba-llm.util';

export interface LlmSummarizeInput {
  context: SummarizeContext;
  systemPrompt: string;
  userContent: string;
  model?: string;
}

export interface LlmSummarizeResult {
  parsed: ReturnType<typeof validateSummarizeOutput>;
  tokenUsage: AiTokenUsage;
  modelName: string;
  stubMode: boolean;
}

export interface LlmFollowUpDraftInput {
  channelHint: FollowUpChannelHint;
  systemPrompt: string;
  userContent: string;
  model?: string;
}

export interface LlmFollowUpDraftResult {
  parsed: FollowUpDraftEngineResult;
  tokenUsage: AiTokenUsage;
  modelName: string;
  stubMode: boolean;
}

export interface LlmNbaInput {
  systemPrompt: string;
  userContent: string;
  model?: string;
  channel?: string | null;
  status?: string | null;
}

export interface LlmNbaResult {
  parsed: NbaLlmSuggestion;
  tokenUsage: AiTokenUsage;
  modelName: string;
  stubMode: boolean;
}

export interface LlmReviewQueueTriageInput {
  systemPrompt: string;
  userContent: string;
  model?: string;
}

export interface LlmReviewQueueTriageResult {
  parsed: Record<string, unknown>;
  tokenUsage: AiTokenUsage;
  modelName: string;
  stubMode: boolean;
}

export interface LlmJsonCompletionInput {
  systemPrompt: string;
  userContent: string;
  model?: string;
  stubJson: () => Record<string, unknown>;
}

export interface LlmJsonCompletionResult {
  parsed: Record<string, unknown>;
  tokenUsage: AiTokenUsage;
  modelName: string;
  stubMode: boolean;
}

@Injectable()
export class AiLlmClient {
  constructor(private readonly aiConfig: AiIntelligenceConfigService) {}

  async summarizeStructured(input: LlmSummarizeInput): Promise<LlmSummarizeResult> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;

    if (!apiKey) {
      const stubRaw = this.buildStubOutput(input.context, input.userContent);
      return {
        parsed: validateSummarizeOutput(stubRaw, input.context),
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: `${model}-stub`,
        stubMode: true,
      };
    }

    try {
      const raw = await this.callOpenAiChat({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        userContent: input.userContent,
        timeoutMs: this.aiConfig.llmTimeoutMs,
      });
      return {
        parsed: validateSummarizeOutput(raw, input.context),
        tokenUsage: raw.tokenUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: model,
        stubMode: false,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async followUpDraftStructured(input: LlmFollowUpDraftInput): Promise<LlmFollowUpDraftResult> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;

    if (!apiKey) {
      const stubRaw = this.buildFollowUpStub(input.channelHint, input.userContent);
      return {
        parsed: validateFollowUpDraftOutput(stubRaw),
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: `${model}-stub`,
        stubMode: true,
      };
    }

    try {
      const raw = await this.callOpenAiChat({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        userContent: input.userContent,
        timeoutMs: this.aiConfig.llmTimeoutMs,
      });
      return {
        parsed: validateFollowUpDraftOutput(raw),
        tokenUsage: raw.tokenUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: model,
        stubMode: false,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async nbaStructured(input: LlmNbaInput): Promise<LlmNbaResult> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;

    if (!apiKey) {
      return {
        parsed: buildNbaLlmStub({ channel: input.channel, status: input.status }),
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: `${model}-stub`,
        stubMode: true,
      };
    }

    try {
      const raw = await this.callOpenAiChat({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        userContent: input.userContent,
        timeoutMs: this.aiConfig.llmTimeoutMs,
      });
      const tokenUsage = raw.tokenUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const parsed =
        parseNbaLlmOutput(raw) ??
        buildNbaLlmStub({ channel: input.channel, status: input.status });
      if (parsed.source === 'llm') {
        parsed.source = 'llm';
      }
      return { parsed, tokenUsage, modelName: model, stubMode: false };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Generic JSON completion for modules that supply their own stub (e.g. MKT-AI planner). */
  async completeJson(input: LlmJsonCompletionInput): Promise<LlmJsonCompletionResult> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;

    if (!apiKey) {
      return {
        parsed: input.stubJson(),
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: `${model}-stub`,
        stubMode: true,
      };
    }

    try {
      const raw = await this.callOpenAiChat({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        userContent: input.userContent,
        timeoutMs: this.aiConfig.llmTimeoutMs,
      });
      const tokenUsage = raw.tokenUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const { tokenUsage: _tu, ...parsed } = raw;
      return { parsed, tokenUsage, modelName: model, stubMode: false };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async reviewQueueTriageStructured(
    input: LlmReviewQueueTriageInput,
  ): Promise<LlmReviewQueueTriageResult> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;

    if (!apiKey) {
      return {
        parsed: { items: [] },
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        modelName: `${model}-stub`,
        stubMode: true,
      };
    }

    try {
      const raw = await this.callOpenAiChat({
        apiKey,
        model,
        systemPrompt: input.systemPrompt,
        userContent: input.userContent,
        timeoutMs: this.aiConfig.llmTimeoutMs,
      });
      const tokenUsage = raw.tokenUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const { tokenUsage: _tu, ...parsed } = raw;
      return { parsed, tokenUsage, modelName: model, stubMode: false };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async callOpenAiChat(args: {
    apiKey: string;
    model: string;
    systemPrompt: string;
    userContent: string;
    timeoutMs: number;
  }): Promise<Record<string, unknown> & { tokenUsage?: AiTokenUsage }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: args.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: args.systemPrompt },
            { role: 'user', content: args.userContent },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      const content = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return {
        ...parsed,
        tokenUsage: {
          prompt_tokens: Number(payload.usage?.prompt_tokens ?? 0),
          completion_tokens: Number(payload.usage?.completion_tokens ?? 0),
          total_tokens: Number(payload.usage?.total_tokens ?? 0),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Plain-text completion (presales consult AI assist, etc.). */
  async completeText(input: {
    userContent: string;
    systemPrompt?: string;
    model?: string;
  }): Promise<{ text: string; stubMode: boolean; modelName: string }> {
    const apiKey = this.aiConfig.llmApiKey;
    const model = input.model ?? this.aiConfig.llmModel;
    const systemPrompt = input.systemPrompt ?? 'You are a helpful marketing consultant assistant.';

    if (!apiKey) {
      const preview = input.userContent.replace(/\s+/g, ' ').trim().slice(0, 180);
      return {
        text:
          `[stub] Phân tích Consult (preview): ${preview || 'Chưa có dữ liệu form.'}\n\n` +
          'Gợi ý: xem lại BANT, pain point và scope trước khi báo giá.',
        stubMode: true,
        modelName: `${model}-stub`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.aiConfig.llmTimeoutMs);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.userContent },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = String(payload.choices?.[0]?.message?.content ?? '').trim();
      return { text, stubMode: false, modelName: model };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ServiceUnavailableException({
          error: 'llm_timeout',
          error_code: AI_AUDIT_ERROR.LLM_TIMEOUT,
          message: 'LLM timeout',
        });
      }
      throw new ServiceUnavailableException({
        error: 'llm_provider_error',
        error_code: AI_AUDIT_ERROR.LLM_PROVIDER_ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private buildStubOutput(context: SummarizeContext, userContent: string): Record<string, unknown> {
    const lines = userContent
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const preview = lines.slice(0, 3).join(' · ').slice(0, 280);

    if (context === 'lead_brief') {
      const sourceLine = lines.find((l) => /nguồn|source|campaign|kênh|channel/i.test(l));
      const bullets = [
        preview || 'Lead mới — cần xác minh nhu cầu với khách.',
        sourceLine ? `Nguồn/campaign: ${sourceLine.slice(0, 120)}` : 'Nguồn: xem timeline hoặc form ingest.',
        'Rủi ro: chưa đủ dữ liệu tương tác — ưu tiên gọi xác nhận.',
        'Next: gọi trong 15 phút và ghi activity.',
      ].slice(0, 5);
      return {
        summary: bullets[0],
        bullets,
        extracted: {
          intent: 'Tìm hiểu nhu cầu',
          objections: [],
          next_action: 'Gọi xác nhận trong 15 phút',
          source: sourceLine ?? null,
          campaign_id: null,
          risk_flags: ['stub_mode'],
          budget_vnd: null,
        },
        confidence: 0.55,
      };
    }

    const text = lines.find((l) => l.startsWith('TEXT:'))?.replace(/^TEXT:\s*/, '') ?? preview;
    return {
      summary: `[stub] ${text.slice(0, 220)}${text.length > 220 ? '…' : ''}`,
      bullets: [],
      extracted: {
        intent: text.includes('?') ? 'Hỏi thêm thông tin' : 'Theo dõi lead',
        objections: [],
        next_action: 'Gửi follow-up xác nhận',
        source: null,
        campaign_id: null,
        risk_flags: ['stub_mode'],
        budget_vnd: null,
      },
      confidence: 0.6,
    };
  }

  private buildFollowUpStub(channel: FollowUpChannelHint, userContent: string): Record<string, unknown> {
    const preview = userContent.replace(/\s+/g, ' ').trim().slice(0, 120);
    const greeting =
      channel === 'email'
        ? 'Chào anh/chị,'
        : channel === 'zalo'
          ? 'Chào anh/chị, em là nhân viên tư vấn PTT.'
          : 'Ghi chú nội bộ — follow-up:';
    const body =
      channel === 'note'
        ? `Cần gọi lại khách${preview ? `: ${preview}` : ''}. Xác nhận lịch hẹn và gửi báo giá nếu khách yêu cầu.`
        : `${greeting}\n\nEm xin phép gửi thông tin follow-up${preview ? ` liên quan ${preview}` : ''}. Anh/chị cho em xin thêm thời gian phù hợp để trao đổi chi tiết ạ.\n\nTrân trọng.`;
    return {
      draft_text: body,
      subject: channel === 'email' ? 'Follow-up — PTT tư vấn' : null,
      confidence: 0.62,
    };
  }
}
