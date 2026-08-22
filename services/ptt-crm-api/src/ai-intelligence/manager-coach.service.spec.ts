import { Test, TestingModule } from '@nestjs/testing';
import { ManagerCoachService } from './manager-coach.service';
import { AiAuditService } from './ai-audit.service';
import { AiInsightsRepository } from './ai-insights.repository';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { PipelineRiskService } from './pipeline-risk.service';
import { AnomalyDigestService } from './anomaly-digest.service';
import { CoachDigestDeliveryService } from './coach-digest-delivery.service';

describe('ManagerCoachService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-coach'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn({ runId: '', requestId: 'req-coach' });
      return { data: result.data, runId: 'run-coach-1', requestId: 'req-coach', latencyMs: 1 };
    }),
  };
  const insights = {
    tableReady: jest.fn().mockResolvedValue(true),
    findCoachDigestForWeek: jest.fn().mockResolvedValue(null),
    insertCoachDigest: jest.fn().mockResolvedValue({
      id: 'insight-1',
      agent_run_id: null,
      created_at: '2026-07-27T01:00:00.000Z',
      metadata: { week_key: '2026-W30', cards: [] },
      entity_id: 'org',
      description: 'Digest narrative',
    }),
    findLatestCoachDigest: jest.fn(),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    getAcceptanceMetrics: jest.fn().mockResolvedValue({
      acceptance_rate_pct: 32,
      accepted: 16,
      dismissed: 34,
      pending: 2,
      top_dismiss_reasons: [{ reason: 'wrong_tone', count: 10 }],
    }),
  };
  const cskhBoard = {
    getBoard: jest.fn().mockResolvedValue({
      summary: { breach: 2, warning: 1, ok: 25, total: 28 },
      sla_dashboard: {
        tiers: {
          first_call_15m: { breach: 2, warning: 1, ok: 10, active: 13 },
          b2_complete_4h: { breach: 0, warning: 1, ok: 12, active: 13 },
          close_24h: { breach: 0, warning: 0, ok: 13, active: 13 },
        },
        selected_tier: 'all',
      },
      items: [],
      total: 28,
      limit: 500,
      offset: 0,
      ok: true,
    }),
    getManagerIntelligence: jest.fn().mockResolvedValue({
      ok: true,
      top_breaches: [{ lead_id: 1, root_cause_label: 'Chưa gọi', tier_label: '15p' }],
      root_cause_counts: { no_call: 2, no_b2: 0, no_close: 0, mixed: 0 },
      rep_performance: [],
      triage_suggestions: [],
    }),
  };
  const pipelineRisk = {
    listAtRiskDeals: jest.fn().mockResolvedValue({
      data: { deals: [], total: 3, last_scan_at: null },
      meta: { request_id: 'r' },
      errors: [],
    }),
  };
  const anomalyDigest = {
    buildCoachFields: jest.fn().mockResolvedValue({
      meta_open_alerts: 1,
      zalo_open_alerts: 0,
      cpl_spike_count: 1,
      zero_leads_24h_count: 0,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: 'CPL spike',
      top_anomaly_channel: 'meta',
      top_anomaly_campaign_id: 'camp_1',
    }),
  };
  const delivery = {
    deliver: jest.fn().mockResolvedValue({ status: 'skipped' }),
  };

  let service: ManagerCoachService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManagerCoachService,
        { provide: AiAuditService, useValue: audit },
        { provide: AiInsightsRepository, useValue: insights },
        { provide: AiRecommendationsRepository, useValue: recommendations },
        { provide: CskhBoardService, useValue: cskhBoard },
        { provide: PipelineRiskService, useValue: pipelineRisk },
        { provide: AnomalyDigestService, useValue: anomalyDigest },
        { provide: CoachDigestDeliveryService, useValue: delivery },
      ],
    }).compile();
    service = module.get(ManagerCoachService);
  });

  it('generates weekly coach digest', async () => {
    const out = await service.generateDigest({ force: true, correlationId: 'gen-1' });
    expect(out.data.created).toBe(true);
    expect(insights.insertCoachDigest).toHaveBeenCalled();
    expect(out.data.agent_run_id).toBe('run-coach-1');
  });

  it('skips when digest already exists for week', async () => {
    insights.findCoachDigestForWeek.mockResolvedValue({
      id: 'existing',
      agent_run_id: 'run-old',
      created_at: '2026-07-26T01:00:00.000Z',
      metadata: { week_key: '2026-W30', week_label: 'w', cards: [] },
      entity_id: 'org',
      description: 'Old',
    });
    const out = await service.generateDigest({});
    expect(out.data.skipped).toBe(true);
    expect(insights.insertCoachDigest).not.toHaveBeenCalled();
  });
});
