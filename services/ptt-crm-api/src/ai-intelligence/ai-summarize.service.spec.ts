import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiSummarizeService } from './ai-summarize.service';

describe('AiSummarizeService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn(async (_ctx, fn) => {
      const result = await fn({ runId: '', requestId: 'req-1' });
      return { ...result, runId: 'run-1', requestId: 'req-1', latencyMs: 12 };
    }),
  };

  const aiConfig = {
    llmModel: 'gpt-4o-mini',
    llmApiKey: null,
    summarizeRateLimitPerMin: 30,
    summarizeMinTextLength: 50,
  };

  const llm = {
    summarizeStructured: jest.fn().mockResolvedValue({
      parsed: {
        summary: 'Tóm tắt test',
        bullets: ['Bullet 1'],
        extracted: {
          intent: 'Mua hàng',
          objections: [],
          next_action: 'Gọi lại',
          source: 'meta',
          campaign_id: null,
          risk_flags: [],
          budget_vnd: null,
        },
        confidence: 0.7,
      },
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      modelName: 'gpt-4o-mini-stub',
      stubMode: true,
    }),
  };

  const prompts = {
    getActivePrompt: jest.fn().mockResolvedValue({
      useCase: 'summarize',
      promptTemplate: 'prompt',
      version: 1,
      source: 'default',
    }),
  };

  const rateLimit = { check: jest.fn() };
  const timeline = { buildAiContext: jest.fn().mockResolvedValue([]) };
  const leadContext = {
    loadLeadScoreContext: jest.fn().mockResolvedValue({
      leadId: 7,
      channel: 'meta',
      source: 'facebook',
      campaignId: 'camp-1',
      status: 'new',
      externalLeadId: 'ext-1',
      isDuplicate: false,
      timelineEventCount: 2,
    }),
  };

  let service: AiSummarizeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiSummarizeService(
      audit as never,
      aiConfig as never,
      llm as never,
      prompts as never,
      rateLimit as never,
      timeline as never,
      leadContext as never,
    );
  });

  it('rejects short activity text', async () => {
    await expect(
      service.summarize({ context: 'activity', text: 'ngắn quá' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('summarizes activity with audit wrap', async () => {
    const text = 'Khách hàng hỏi về gói dịch vụ và muốn báo giá chi tiết qua Zalo. '.repeat(2);
    const out = await service.summarize({
      context: 'activity',
      text,
      entityType: 'lead',
      entityId: '7',
      actorId: 'staff-1',
    });
    expect(out.data.summary).toBe('Tóm tắt test');
    expect(out.data.agent_run_id).toBe('run-1');
    expect(audit.wrap).toHaveBeenCalled();
    expect(rateLimit.check).toHaveBeenCalledWith('staff-1', 30);
  });

  it('builds lead brief from lead context', async () => {
    prompts.getActivePrompt.mockResolvedValue({
      useCase: 'lead_brief',
      promptTemplate: 'brief prompt',
      version: 1,
      source: 'default',
    });
    const out = await service.summarize({
      context: 'lead_brief',
      entityType: 'lead',
      entityId: '7',
      actorId: 'staff-1',
    });
    expect(out.data.context).toBe('lead_brief');
    expect(out.data.bullets.length).toBeGreaterThan(0);
    expect(leadContext.loadLeadScoreContext).toHaveBeenCalledWith(7);
  });

  it('404 when lead missing for brief', async () => {
    leadContext.loadLeadScoreContext.mockResolvedValue(null);
    await expect(
      service.summarize({
        context: 'lead_brief',
        entityType: 'lead',
        entityId: '999',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
