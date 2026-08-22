import { Test, TestingModule } from '@nestjs/testing';
import { RenewalAgentService } from './renewal-agent.service';
import { AiAuditService } from './ai-audit.service';
import { RenewalContractContextRepository } from './renewal-contract-context.repository';
import { RenewalOpportunitiesRepository } from './renewal-opportunities.repository';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AgencyRepository } from '../agency/agency.repository';
import { LifecycleTasksRepository } from '../service-lifecycle/lifecycle-tasks.repository';

describe('RenewalAgentService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-renewal'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn();
      return { ...result, runId: 'run-renewal-1' };
    }),
  };
  const contracts = {
    listRenewalCandidates: jest.fn().mockReturnValue([
      {
        contract_id: 11,
        agency_client_id: '00000000-0000-0000-0000-000000000101',
        client_name: 'Demo',
        contract_title: 'HĐ 2026',
        ends_on: '2026-08-30',
        amount_vnd: 40_000_000,
        days_until_end: 35,
        trigger_window: 60,
        lifecycle_id: 5,
      },
    ]),
  };
  const opportunities = {
    tableReady: jest.fn().mockResolvedValue(true),
    findByContractRef: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({ id: 'opp-1' }),
    listByClient: jest.fn().mockResolvedValue([]),
    getById: jest.fn(),
    updateMetadata: jest.fn(),
    patchStatus: jest.fn(),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    insert: jest.fn().mockResolvedValue({ id: 'rec-renewal-1' }),
    updateStatus: jest.fn(),
  };
  const agencyRepo = {
    fetchClient: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000101', name: 'Demo Client' }),
  };
  const lifecycleTasks = {
    createCustomTask: jest.fn().mockReturnValue({ id: 901 }),
  };

  let service: RenewalAgentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalAgentService,
        { provide: AiAuditService, useValue: audit },
        { provide: RenewalContractContextRepository, useValue: contracts },
        { provide: RenewalOpportunitiesRepository, useValue: opportunities },
        { provide: AiRecommendationsRepository, useValue: recommendations },
        { provide: AgencyRepository, useValue: agencyRepo },
        { provide: LifecycleTasksRepository, useValue: lifecycleTasks },
      ],
    }).compile();
    service = module.get(RenewalAgentService);
  });

  it('scan creates renewal opportunity', async () => {
    const out = await service.scanRenewalWindows({ correlationId: 'scan-1' });
    expect(out.data.created).toBe(1);
    expect(opportunities.insert).toHaveBeenCalled();
  });

  it('approve creates retain follow-up task', async () => {
    opportunities.getById.mockResolvedValue({
      id: 'opp-1',
      client_id: '00000000-0000-0000-0000-000000000101',
      contract_ref: '11:T60',
      renewal_date: '2026-08-30',
      risk_level: 'medium',
      status: 'open',
      owner_am_id: null,
      metadata: {
        draft_text: 'Draft renewal',
        recommendation_id: 'rec-renewal-1',
        lifecycle_id: 5,
      },
      created_at: '',
      updated_at: '',
    });
    opportunities.patchStatus.mockResolvedValue({});

    const out = await service.approveDraft('opp-1', 'Draft renewal', 'am-1', 'am@demo.local');
    expect(out.data.follow_up_task_id).toBe(901);
    expect(lifecycleTasks.createCustomTask).toHaveBeenCalledWith(
      5,
      'retain',
      expect.any(String),
      'Draft renewal',
    );
  });
});
