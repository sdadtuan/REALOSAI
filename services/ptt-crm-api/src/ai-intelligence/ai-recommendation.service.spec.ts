import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiRecommendationService } from './ai-recommendation.service';

describe('AiRecommendationService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn(async (_ctx, fn) => {
      const result = await fn({ runId: '', requestId: 'req-1' });
      return { ...result, runId: 'run-1', requestId: 'req-1', latencyMs: 15 };
    }),
  };

  const aiConfig = {
    llmModel: 'gpt-4o-mini',
    llmApiKey: null,
    summarizeRateLimitPerMin: 30,
  };

  const llm = {
    followUpDraftStructured: jest.fn().mockResolvedValue({
      parsed: {
        draft_text: 'Chào anh/chị, em xin phép follow-up về gói dịch vụ quảng cáo Meta ạ.',
        subject: null,
        confidence: 0.72,
      },
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      modelName: 'gpt-4o-mini-stub',
      stubMode: true,
    }),
  };

  const prompts = {
    getActivePrompt: jest.fn().mockResolvedValue({
      useCase: 'follow_up_draft',
      promptTemplate: 'draft prompt',
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
      timelineEventCount: 1,
    }),
  };

  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    insert: jest.fn().mockResolvedValue({
      id: 'rec-1',
      client_id: null,
      entity_type: 'lead',
      entity_id: '7',
      recommendation_type: 'follow_up_draft',
      recommendation_text: 'Chào anh/chị, em xin phép follow-up về gói dịch vụ quảng cáo Meta ạ.',
      action_json: { channel_hint: 'zalo', subject: null, stub_mode: true },
      confidence: 0.72,
      status: 'pending',
      dismissed_reason: null,
      accepted_by: null,
      accepted_at: null,
      agent_run_id: 'run-1',
      created_at: '2026-07-26T00:00:00Z',
      updated_at: '2026-07-26T00:00:00Z',
    }),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    listByEntity: jest.fn(),
  };

  const crmLegacy = {
    createActivity: jest.fn().mockResolvedValue({ activity: { id: 501 } }),
  };

  const nba = {
    executeNbaAccept: jest.fn(),
  };

  const leadRoute = {
    executeRouteAccept: jest.fn(),
  };

  let service: AiRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiRecommendationService(
      audit as never,
      aiConfig as never,
      llm as never,
      prompts as never,
      rateLimit as never,
      timeline as never,
      leadContext as never,
      recommendations as never,
      nba as never,
      leadRoute as never,
      crmLegacy as never,
    );
  });

  it('rejects invalid recommendation type', async () => {
    await expect(
      service.createFollowUpDraft({
        type: 'other',
        entityType: 'lead',
        entityId: '7',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates follow-up draft with audit wrap', async () => {
    const out = await service.createFollowUpDraft({
      type: 'follow_up_draft',
      entityType: 'lead',
      entityId: '7',
      channelHint: 'zalo',
      actorId: 'staff-1',
    });
    expect(out.data.id).toBe('rec-1');
    expect(out.data.status).toBe('pending');
    expect(out.data.channel_hint).toBe('zalo');
    expect(audit.wrap).toHaveBeenCalled();
    expect(recommendations.insert).toHaveBeenCalled();
    expect(rateLimit.check).toHaveBeenCalledWith('staff-1', 30);
  });

  it('404 when lead missing', async () => {
    leadContext.loadLeadScoreContext.mockResolvedValueOnce(null);
    await expect(
      service.createFollowUpDraft({
        type: 'follow_up_draft',
        entityType: 'lead',
        entityId: '999',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('503 when schema not ready', async () => {
    recommendations.tableReady.mockResolvedValueOnce(false);
    await expect(
      service.createFollowUpDraft({
        type: 'follow_up_draft',
        entityType: 'lead',
        entityId: '7',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('accepts draft and creates CRM activity note', async () => {
    recommendations.findById.mockResolvedValueOnce({
      id: 'rec-1',
      client_id: null,
      entity_type: 'lead',
      entity_id: '7',
      recommendation_type: 'follow_up_draft',
      recommendation_text: 'Draft gốc đủ mười ký tự.',
      action_json: { channel_hint: 'email', subject: 'Follow-up PTT' },
      confidence: 0.7,
      status: 'pending',
      dismissed_reason: null,
      accepted_by: null,
      accepted_at: null,
      agent_run_id: 'run-1',
      created_at: '2026-07-26T00:00:00Z',
      updated_at: '2026-07-26T00:00:00Z',
    });
    recommendations.updateStatus.mockResolvedValueOnce({
      id: 'rec-1',
      client_id: null,
      entity_type: 'lead',
      entity_id: '7',
      recommendation_type: 'follow_up_draft',
      recommendation_text: 'Nội dung đã chỉnh sửa đủ mười ký tự.',
      action_json: { channel_hint: 'email', subject: 'Follow-up PTT' },
      confidence: 0.7,
      status: 'accepted',
      dismissed_reason: null,
      accepted_by: 'staff-1',
      accepted_at: '2026-07-26T01:00:00Z',
      agent_run_id: 'run-1',
      created_at: '2026-07-26T00:00:00Z',
      updated_at: '2026-07-26T01:00:00Z',
    });

    const out = await service.patchRecommendation('rec-1', {
      status: 'accepted',
      finalText: 'Nội dung đã chỉnh sửa đủ mười ký tự.',
      actorId: 'staff-1',
      actorUserId: 1,
    });

    expect(out.data.status).toBe('accepted');
    expect(out.data.activity_id).toBe(501);
    expect(crmLegacy.createActivity).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ activity_type: 'note' }),
      'staff-1',
      1,
    );
  });

  it('rejects patch when not pending', async () => {
    recommendations.findById.mockResolvedValueOnce({
      id: 'rec-1',
      entity_type: 'lead',
      entity_id: '7',
      recommendation_type: 'follow_up_draft',
      recommendation_text: 'Draft đã xử lý đủ mười ký tự.',
      action_json: { channel_hint: 'zalo' },
      confidence: 0.7,
      status: 'accepted',
      dismissed_reason: null,
      accepted_by: 'staff-1',
      accepted_at: '2026-07-26T00:00:00Z',
      agent_run_id: 'run-1',
      created_at: '2026-07-26T00:00:00Z',
      updated_at: '2026-07-26T00:00:00Z',
      client_id: null,
    });
    await expect(
      service.patchRecommendation('rec-1', { status: 'dismissed' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists recommendations by entity', async () => {
    recommendations.listByEntity.mockResolvedValueOnce([]);
    const out = await service.listRecommendations('lead', '7', 'pending', 5, 'req-list');
    expect(out.data.recommendations).toEqual([]);
    expect(out.meta.request_id).toBe('req-list');
  });
});
