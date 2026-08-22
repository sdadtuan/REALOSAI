import { Test, TestingModule } from '@nestjs/testing';
import { AiAdoptionAnalyticsService } from './ai-adoption-analytics.service';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiRecommendationsRepository } from './ai-recommendations.repository';

describe('AiAdoptionAnalyticsService', () => {
  const audit = { newRequestId: jest.fn().mockReturnValue('req-adopt') };
  const runs = {
    tableReady: jest.fn().mockResolvedValue(true),
    getCopilotDailyDau: jest.fn().mockResolvedValue([
      { day: '2026-07-25', dau: 3 },
      { day: '2026-07-26', dau: 4 },
    ]),
  };
  const recommendations = {
    getAcceptanceMetrics: jest.fn().mockResolvedValue({
      acceptance_rate_pct: 42,
      accepted: 21,
      dismissed: 29,
      pending: 2,
      total_resolved: 50,
      by_type: [],
      top_dismiss_reasons: [],
    }),
  };
  const aiConfig = { pilotUserIds: ['1', '2', '3', '4', '5'] };

  let service: AiAdoptionAnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAdoptionAnalyticsService,
        { provide: AiAuditService, useValue: audit },
        { provide: AiAgentRunsRepository, useValue: runs },
        { provide: AiRecommendationsRepository, useValue: recommendations },
        { provide: AiIntelligenceConfigService, useValue: aiConfig },
      ],
    }).compile();
    service = module.get(AiAdoptionAnalyticsService);
  });

  it('returns adoption metrics with DoD gates', async () => {
    const out = await service.getAdoptionMetrics({ days: 14 });
    expect(out.data.copilot_dau_latest).toBe(4);
    expect(out.data.acceptance_gate_pass).toBe(true);
    expect(out.data.dod_v1_summary.acceptance_ge_40).toBe(true);
  });
});
