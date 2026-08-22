import { AiLeadScoreService } from './ai-lead-score.service';

describe('AiLeadScoreService', () => {
  const scores = {
    tableReady: jest.fn().mockResolvedValue(true),
    findRecentAutoScore: jest.fn().mockResolvedValue(null),
    insertScore: jest.fn().mockResolvedValue({
      id: 'score-1',
      score_value: 72,
      confidence: 0.8,
      explainability_json: { factors: [], flags: [], score_band: 'hot' },
      model_name: 'rules-v1',
      model_version: 'lead-v1',
      calculated_at: '2026-07-26T09:00:00Z',
      agent_run_id: 'run-1',
    }),
    insertOverrideScore: jest.fn().mockResolvedValue({
      id: 'score-override-1',
      score_value: 88,
      confidence: 0.8,
      explainability_json: {
        factors: [{ key: 'gdkd_override', label: 'GDKD điều chỉnh: VIP khách', delta: 0, sign: '+' }],
        flags: ['manual_override'],
        score_band: 'hot',
      },
      model_name: 'manual_override',
      model_version: 'lead-v1',
      calculated_at: '2026-07-26T10:00:00Z',
      agent_run_id: 'run-override',
      overridden_by: 'gdkd-1',
      override_reason: 'VIP khách quan trọng',
    }),
    getLatest: jest.fn().mockResolvedValue({
      id: 'score-1',
      score_value: 45,
      confidence: 0.7,
      explainability_json: { factors: [{ key: 'cold', label: 'Thiếu data', delta: -10, sign: '-' }], flags: [], score_band: 'warm' },
      client_id: 'client-1',
    }),
    listScores: jest.fn(),
    listLatestForEntities: jest.fn().mockResolvedValue([]),
  };

  const contextRepo = {
    loadLeadScoreContext: jest.fn().mockResolvedValue({
      leadId: 99,
      clientId: 'client-1',
      channel: 'meta',
      source: 'facebook',
      campaignId: 'c1',
      externalLeadId: 'ext',
      status: 'new',
      isDuplicate: false,
      receivedAt: new Date('2026-07-26T08:00:00Z'),
      createdAt: new Date('2026-07-26T08:00:00Z'),
      firstContactAt: null,
      timelineEventCount: 1,
      meta: {},
      estimatedDealValueVnd: null,
    }),
  };

  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn().mockResolvedValue({
      data: {
        score: 72,
        confidence: 0.8,
        explainability: { factors: [], flags: [], score_band: 'hot' },
        features: {},
      },
      runId: 'run-1',
      requestId: 'req-1',
      latencyMs: 5,
    }),
  };

  const events = {
    emit: jest.fn().mockResolvedValue('ev-1'),
  };

  const leads = {
    getLeadById: jest.fn().mockResolvedValue({ id: 99, owner_id: 1 }),
  };

  const staffAuth = {
    me: jest.fn(),
    hasCap: jest.fn().mockReturnValue(true),
  };

  const aiConfig = {
    scoreV2Enabled: false,
  };

  const scoreFeedback = {
    aggregateForLead: jest.fn().mockResolvedValue({
      override_count: 0,
      avg_override_score: null,
      outcome_chot: 0,
      outcome_lost: 0,
      outcome_stalled: 0,
    }),
    recordOverride: jest.fn().mockResolvedValue(undefined),
  };

  let service: AiLeadScoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiLeadScoreService(
      scores as never,
      contextRepo as never,
      audit as never,
      events as never,
      leads as never,
      staffAuth as never,
      aiConfig as never,
      scoreFeedback as never,
    );
  });

  it('persists score and emits LeadScored', async () => {
    const res = await service.scoreLead({ leadId: 99, actorId: 'staff-1' });

    expect(res.data.score).toBe(72);
    expect(res.data.idempotent_replay).toBe(false);
    expect(scores.insertScore).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'LeadScored',
      'lead',
      '99',
      expect.objectContaining({ score: 72 }),
      'req-1',
      expect.any(String),
    );
  });

  it('returns idempotent replay within window', async () => {
    scores.findRecentAutoScore.mockResolvedValueOnce({
      id: 'score-old',
      score_value: 60,
      confidence: 0.7,
      explainability_json: { factors: [], flags: [], score_band: 'warm' },
      model_name: 'rules-v1',
      model_version: 'lead-v1',
      calculated_at: '2026-07-26T08:55:00Z',
      agent_run_id: 'run-old',
    });

    const res = await service.scoreLead({ leadId: 99 });
    expect(res.data.idempotent_replay).toBe(true);
    expect(audit.wrap).not.toHaveBeenCalled();
  });

  it('overrideLeadScore persists manual override and emits LeadScoreOverridden', async () => {
    audit.wrap.mockResolvedValueOnce({
      data: { score: 88, override_reason: 'VIP khách quan trọng cần ưu tiên' },
      runId: 'run-override',
      requestId: 'req-override',
      latencyMs: 3,
    });

    const res = await service.overrideLeadScore({
      leadId: 99,
      score: 88,
      overrideReason: 'VIP khách quan trọng cần ưu tiên',
      actorId: 'gdkd-1',
    });

    expect(res.data.score).toBe(88);
    expect(scores.insertOverrideScore).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreValue: 88,
        overriddenBy: 'gdkd-1',
        overrideReason: 'VIP khách quan trọng cần ưu tiên',
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'LeadScoreOverridden',
      'lead',
      '99',
      expect.objectContaining({ overridden_by: 'gdkd-1' }),
      'req-1',
      expect.any(String),
    );
    expect(scoreFeedback.recordOverride).toHaveBeenCalledWith({
      leadId: 99,
      staffId: 'gdkd-1',
      overrideScore: 88,
    });
  });

  it('overrideLeadScore rejects short reason', async () => {
    await expect(
      service.overrideLeadScore({
        leadId: 99,
        score: 80,
        overrideReason: 'ngắn',
        actorId: 'gdkd-1',
      }),
    ).rejects.toMatchObject({ response: { error: 'override_reason_too_short' } });
  });
});
