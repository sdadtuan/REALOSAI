import { Test, TestingModule } from '@nestjs/testing';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { CasesService } from '../cases/cases.service';

describe('PipelineRiskService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn(async (_meta, fn) => {
      const data = await fn();
      return { ...data, runId: 'run-1' };
    }),
  };
  const dealContext = {
    listOpenDealIds: jest.fn().mockReturnValue([101]),
    loadDealScoreContext: jest.fn(),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    findById: jest.fn(),
    findRecentPendingByType: jest.fn().mockResolvedValue(null),
    dismissPendingByTypeForEntity: jest.fn().mockResolvedValue(0),
    mergeActionJson: jest.fn(),
    insert: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    listPendingByType: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    latestScanTimestamp: jest.fn().mockResolvedValue(null),
  };
  const cases = {
    addEvent: jest.fn().mockReturnValue({ id: 9001, created_at: '2026-07-26T10:00:00.000Z' }),
  };

  let service: PipelineRiskService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineRiskService,
        { provide: AiAuditService, useValue: audit },
        { provide: DealScoreContextRepository, useValue: dealContext },
        { provide: AiRecommendationsRepository, useValue: recommendations },
        { provide: CasesService, useValue: cases },
      ],
    }).compile();
    service = module.get(PipelineRiskService);
  });

  it('creates pipeline_risk alert for stalled deal', async () => {
    const stale = new Date(Date.now() - 10 * 86_400_000);
    dealContext.loadDealScoreContext.mockReturnValue({
      dealId: 101,
      title: 'Deal A',
      pipelineStage: 'sql',
      isTerminal: false,
      dealValueVnd: 10_000_000,
      stageEnteredAt: stale,
      updatedAt: stale,
      lastActivityAt: stale,
      activityCount7d: 0,
      status: 'open',
      clientId: null,
    });

    const out = await service.scanDaily({ correlationId: 'scan-1' });
    expect(out.data.at_risk_found).toBe(1);
    expect(out.data.alerts_created).toBe(1);
    expect(recommendations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'deal',
        entityId: '101',
        recommendationType: 'pipeline_risk',
      }),
    );
  });

  it('clears pending alert when deal no longer stalled', async () => {
    const recent = new Date();
    dealContext.loadDealScoreContext.mockReturnValue({
      dealId: 101,
      title: 'Deal B',
      pipelineStage: 'sql',
      isTerminal: false,
      dealValueVnd: 10_000_000,
      stageEnteredAt: recent,
      updatedAt: recent,
      lastActivityAt: recent,
      activityCount7d: 3,
      status: 'open',
      clientId: null,
    });
    recommendations.dismissPendingByTypeForEntity.mockResolvedValue(1);

    const out = await service.scanDaily();
    expect(out.data.alerts_cleared).toBe(1);
    expect(recommendations.insert).not.toHaveBeenCalled();
  });

  it('assigns follow-up owner on pending alert', async () => {
    recommendations.findById.mockResolvedValue({
      id: 'rec-1',
      entity_type: 'deal',
      entity_id: '101',
      recommendation_type: 'pipeline_risk',
      status: 'pending',
      action_json: {},
    });
    recommendations.mergeActionJson.mockResolvedValue({ id: 'rec-1' });

    const out = await service.assignFollowUpOwner({
      recommendationId: 'rec-1',
      staffId: 7,
      staffName: 'Sales A',
      actorId: 'gdkd@pttads.vn',
    });

    expect(out.data.follow_up_owner_id).toBe(7);
    expect(recommendations.mergeActionJson).toHaveBeenCalled();
  });

  it('logs activity and clears risk flag', async () => {
    recommendations.findById.mockResolvedValue({
      id: 'rec-1',
      entity_type: 'deal',
      entity_id: '101',
      recommendation_type: 'pipeline_risk',
      status: 'pending',
      action_json: {},
    });
    recommendations.dismissPendingByTypeForEntity.mockResolvedValue(1);

    const out = await service.logFollowUpActivity({
      recommendationId: 'rec-1',
      note: 'Gọi khách xác nhận timeline',
      actorId: 'sales@pttads.vn',
    });

    expect(cases.addEvent).toHaveBeenCalledWith(101, expect.objectContaining({ body: expect.stringContaining('Gọi khách') }));
    expect(out.data.risk_cleared).toBe(true);
  });
});
