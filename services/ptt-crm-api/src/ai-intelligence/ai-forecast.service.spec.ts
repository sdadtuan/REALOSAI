import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../config/app-config.service';
import { CrmConfigService } from '../crm-config/crm-config.service';
import { AiForecastService } from './ai-forecast.service';
import { AiAuditService } from './ai-audit.service';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { RevenueForecastRepository } from './revenue-forecast.repository';

describe('AiForecastService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-forecast'),
    wrap: jest.fn(async (_meta, fn) => {
      const result = await fn();
      return { ...result, runId: 'run-forecast-1' };
    }),
  };
  const config = { sqlitePath: ':memory:' };
  const crmConfig = { toPipelineRuntime: jest.fn().mockReturnValue({ labels: {} }) };
  const dealContext = {
    listOpenDealIds: jest.fn().mockReturnValue([]),
    loadDealScoreContext: jest.fn(),
  };
  const snapshots = {
    tableReady: jest.fn().mockResolvedValue(true),
    findBySnapshotDate: jest.fn().mockResolvedValue(null),
    deleteUncommittedOrgSnapshotForDate: jest.fn().mockResolvedValue(0),
    insertSnapshot: jest.fn().mockResolvedValue({
      id: 'snap-1',
      snapshot_date: '2026-07-26',
      pipeline_amount: 0,
      forecast_amount: 0,
      ai_adjustment: 0,
      best_case_amount: 0,
      metadata: { stalled_deal_count: 0 },
      created_at: '2026-07-26T00:00:00.000Z',
      committed_amount: 0,
      confidence_score: 0.5,
      committed_by: null,
      committed_at: null,
      agent_run_id: null,
    }),
    findLatestInMonth: jest.fn().mockResolvedValue({
      id: 'snap-1',
      snapshot_date: '2026-07-26',
      pipeline_amount: 100,
      forecast_amount: 90,
      ai_adjustment: -10,
      best_case_amount: 200,
      committed_amount: 0,
      confidence_score: 0.7,
      committed_by: null,
      committed_at: null,
      agent_run_id: 'run-1',
      metadata: { stalled_deal_count: 1, factors: [], stage_buckets: [], summary_note: 'note' },
      created_at: '2026-07-26T00:00:00.000Z',
    }),
    findCommittedForMonth: jest.fn().mockResolvedValue({
      id: 'snap-prior',
      committed_amount: 120,
    }),
    commitSnapshot: jest.fn(),
  };

  let service: AiForecastService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiForecastService,
        { provide: AppConfigService, useValue: config },
        { provide: CrmConfigService, useValue: crmConfig },
        { provide: AiAuditService, useValue: audit },
        { provide: DealScoreContextRepository, useValue: dealContext },
        { provide: RevenueForecastRepository, useValue: snapshots },
      ],
    }).compile();
    service = module.get(AiForecastService);
  });

  it('creates daily snapshot', async () => {
    const out = await service.generateSnapshot({ correlationId: 'scan-1', snapshotDate: '2026-07-26' });
    expect(out.data.skipped).toBe(false);
    expect(out.data.agent_run_id).toBe('run-forecast-1');
    expect(snapshots.insertSnapshot).toHaveBeenCalled();
  });

  it('rejects commit when snapshot already committed', async () => {
    snapshots.commitSnapshot.mockResolvedValue(null);
    await expect(
      service.commitForecast({
        snapshotId: 'snap-1',
        committedAmountVnd: 50,
        actorEmail: 'gdkd@demo.local',
        acknowledgeMapeWarning: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('commits when MAPE warning acknowledged', async () => {
    snapshots.commitSnapshot.mockResolvedValue({
      id: 'snap-1',
      committed_amount: 50,
      committed_by: 'gdkd@demo.local',
      committed_at: '2026-07-26T10:00:00.000Z',
    });
    const out = await service.commitForecast({
      snapshotId: 'snap-1',
      committedAmountVnd: 50,
      actorEmail: 'gdkd@demo.local',
      acknowledgeMapeWarning: true,
    });
    expect(out.data.committed_amount).toBe(50);
  });

  it('returns forecast variance for leadership dashboard', async () => {
    const out = await service.getForecastVariance('req-variance');
    expect(out.data.committed_vnd).toBe(120);
    expect(out.meta.request_id).toBeTruthy();
  });

  it('returns MAPE report artifact', async () => {
    const out = await service.getMapeReport(3, 'req-mape');
    expect(out.data.rows.length).toBe(3);
    expect(out.data.target_mape_pct).toBe(20);
  });
});
