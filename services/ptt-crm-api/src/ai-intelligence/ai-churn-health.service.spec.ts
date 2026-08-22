import { Test, TestingModule } from '@nestjs/testing';
import { AiChurnHealthService } from './ai-churn-health.service';
import { AiAuditService } from './ai-audit.service';
import { ChurnHealthContextRepository } from './churn-health-context.repository';
import { CustomerHealthScoresRepository } from './customer-health-scores.repository';
import { AgencyRepository } from '../agency/agency.repository';
import { AiRecommendationsRepository } from './ai-recommendations.repository';

describe('AiChurnHealthService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-churn'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn();
      return { ...result, runId: 'run-churn-1' };
    }),
  };
  const scores = {
    tableReady: jest.fn().mockResolvedValue(true),
    wasScoredWithinHours: jest.fn().mockResolvedValue(false),
    insert: jest.fn().mockResolvedValue({ id: 'score-1' }),
    findLatestByClient: jest.fn(),
    listLatestDashboard: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  const context = {
    buildSignalsForClients: jest.fn().mockReturnValue(
      new Map([
        [
          '00000000-0000-0000-0000-000000000101',
          {
            contract_days_until_end: 45,
            contract_amount_vnd: 30_000_000,
            lifecycle_id: 2,
            tickets_open: 1,
            tickets_last_7d: 1,
            tickets_prev_7d: 0,
            ticket_spike: false,
            negative_tickets_open: 0,
            payment_overdue_vnd: 0,
            payment_overdue_count: 0,
          },
        ],
      ]),
    ),
  };
  const agencyRepo = {
    listClients: jest.fn().mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000101',
        code: 'ACME',
        name: 'Demo Client',
        owner_am_id: 'am@pttads.vn',
        status: 'active',
      },
    ]),
    fetchClient: jest.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000101',
      code: 'ACME',
      name: 'Demo Client',
      owner_am_id: 'am@pttads.vn',
      status: 'active',
    }),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    insert: jest.fn().mockResolvedValue({
      id: 'plan-1',
      created_at: '2026-07-26T12:00:00.000Z',
    }),
    listByTypeForEntity: jest.fn().mockResolvedValue([]),
    listRecent: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };

  let service: AiChurnHealthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChurnHealthService,
        { provide: AiAuditService, useValue: audit },
        { provide: CustomerHealthScoresRepository, useValue: scores },
        { provide: ChurnHealthContextRepository, useValue: context },
        { provide: AgencyRepository, useValue: agencyRepo },
        { provide: AiRecommendationsRepository, useValue: recommendations },
      ],
    }).compile();
    service = module.get(AiChurnHealthService);
  });

  it('scores active clients in batch scan', async () => {
    const out = await service.scoreChurn({ correlationId: 'scan-1', force: true });
    expect(out.data.scored).toBe(1);
    expect(scores.insert).toHaveBeenCalled();
  });

  it('returns dashboard payload', async () => {
    scores.listLatestDashboard.mockResolvedValue({
      rows: [
        {
          id: 'score-1',
          client_id: '00000000-0000-0000-0000-000000000101',
          score: 62,
          components_json: {
            health_band: 'watch',
            churn_risk_pct: 38,
            risk_level: 'medium',
            ticket_spike: false,
            renewal_recommended: false,
            factors: [],
            signals: {},
          },
          ai_score_id: null,
          calculated_at: '2026-07-26T00:00:00.000Z',
          created_at: '2026-07-26T00:00:00.000Z',
        },
      ],
      total: 1,
    });
    const out = await service.getDashboard({ sort: 'churn_risk', order: 'desc' });
    expect(out.data.total).toBe(1);
    expect(out.data.clients[0]?.client_name).toBe('Demo Client');
  });

  it('logs churn recovery plan note', async () => {
    const out = await service.logRecoveryPlan({
      clientId: '00000000-0000-0000-0000-000000000101',
      note: 'Gọi AM tuần tới — review ticket spike',
      actorId: 'am@pttads.vn',
      actorName: 'am@pttads.vn',
    });
    expect(out.data.note).toContain('ticket spike');
    expect(recommendations.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recommendationType: 'churn_recovery_plan' }),
    );
  });
});
