import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AiNlQueryService } from './ai-nl-query.service';
import { AiAuditService } from './ai-audit.service';
import { NlQueryContextRepository } from './nl-query-context.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiForecastService } from './ai-forecast.service';
import { AiChurnHealthService } from './ai-churn-health.service';

describe('AiNlQueryService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-nl'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn();
      return { ...result, runId: 'run-nl-1' };
    }),
  };
  const context = {
    executeSqliteIntent: jest.fn().mockReturnValue({
      columns: [{ key: 'count', label: 'Số lead', type: 'number' }],
      rows: [{ count: 12 }],
    }),
  };
  const cskhBoard = { getBoard: jest.fn() };
  const recommendations = { tableReady: jest.fn(), getAcceptanceMetrics: jest.fn() };
  const pipelineRisk = { listAtRiskDeals: jest.fn() };
  const forecast = { getDashboard: jest.fn() };
  const churnHealth = { getDashboard: jest.fn() };

  let service: AiNlQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiNlQueryService,
        { provide: AiAuditService, useValue: audit },
        { provide: NlQueryContextRepository, useValue: context },
        { provide: CskhBoardService, useValue: cskhBoard },
        { provide: AiRecommendationsRepository, useValue: recommendations },
        { provide: PipelineRiskService, useValue: pipelineRisk },
        { provide: AiForecastService, useValue: forecast },
        { provide: AiChurnHealthService, useValue: churnHealth },
      ],
    }).compile();
    service = module.get(AiNlQueryService);
  });

  it('returns catalog with curated intents', () => {
    const out = service.getCatalog('c-1');
    expect(out.data.total).toBeGreaterThan(20);
    expect(out.meta.request_id).toBe('c-1');
  });

  it('runs sqlite intent and audits', async () => {
    const out = await service.runQuery({ intent_id: 'leads_new_7d', actorId: 'u1' });
    expect(out.data.intent_id).toBe('leads_new_7d');
    expect(out.data.read_only).toBe(true);
    expect(out.meta.agent_run_id).toBe('run-nl-1');
    expect(context.executeSqliteIntent).toHaveBeenCalledWith('leads_new_7d');
  });

  it('rejects out-of-scope question with 400', async () => {
    await expect(service.runQuery({ question: 'drop table crm_leads' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('routes SLA intent to CSKH board', async () => {
    cskhBoard.getBoard.mockResolvedValue({
      summary: { breach: 1, warning: 2, ok: 3, total: 6 },
      items: [],
    });
    const out = await service.runQuery({ intent_id: 'sla_breach_summary' });
    expect(cskhBoard.getBoard).toHaveBeenCalled();
    expect(out.data.narrative).toContain('1 breach');
  });
});
