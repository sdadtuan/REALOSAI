import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiJobWorkerService } from './marketing-ai-job-worker.service';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

describe('MarketingAiMultiAgentService', () => {
  let asyncEnabled = false;
  const config = {
    mktAiPlannerEnabled: true,
    mktAiMultiAgentEnabled: true,
    get mktAiMultiAgentAsync() {
      return asyncEnabled;
    },
  } as AppConfigService;

  const repo = {
    listJobs: jest.fn(),
    getBrief: jest.fn(),
    getDraft: jest.fn(),
    createJob: jest.fn(),
    finishJob: jest.fn(),
    patchJob: jest.fn(),
    getJobById: jest.fn(),
  } as unknown as MarketingAiPlannerRepository;

  const playbooks = {
    isEnabled: jest.fn().mockReturnValue(true),
    listForLifecycle: jest.fn().mockReturnValue({ active_slug: 'meta-lead-gen' }),
    mergeAndPersistPlaybook: jest.fn(),
  } as unknown as MarketingAiPlaybookService;

  const planner = {
    loadLifecyclePublic: jest.fn().mockResolvedValue({ service_slug: 'meta-lead-gen' }),
    assertEnabledPublic: jest.fn(),
    getOrchestratorModelName: jest.fn().mockReturnValue('gpt-4o-mini'),
    isStubMode: jest.fn().mockReturnValue(true),
    runStrategyJob: jest.fn().mockResolvedValue({ job_id: 11, status: 'succeeded' }),
    runCampaignJob: jest.fn().mockResolvedValue({ job_id: 12, status: 'succeeded' }),
    runContentJob: jest.fn().mockResolvedValue({ job_id: 13, status: 'succeeded' }),
    runQualityJob: jest.fn().mockResolvedValue({ job_id: 14, status: 'succeeded' }),
  } as unknown as MarketingAiPlannerService;

  const worker = {
    triggerJob: jest.fn(),
  } as unknown as MarketingAiJobWorkerService;

  const service = new MarketingAiMultiAgentService(config, repo, playbooks, planner, worker);

  beforeEach(() => {
    jest.clearAllMocks();
    asyncEnabled = false;
    repo.listJobs = jest.fn().mockResolvedValue([]);
    repo.getBrief = jest.fn().mockResolvedValue({
      brief_json: {
        brand_name: 'ACME',
        industry: 'Logistics',
        service_slug: 'meta-lead-gen',
        objective: 'lead',
        budget_monthly_vnd: 50_000_000,
        geo_markets: ['HCM'],
        challenges: 'CPL cao',
      },
    });
    repo.getDraft = jest.fn().mockResolvedValue({
      strategy_framework: { target_market: 'x' },
      target_market_prof: { segmentation_icp: 'y'.repeat(90) },
      swot_json: {},
      campaigns_json: [{ name: 'A', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] }],
      content_json: { calendar: [{ date: '2026-08-01' }] },
      quality_score_json: {},
    });
    repo.createJob = jest.fn().mockResolvedValue({ id: 99, status: 'running', input_json: {} });
    repo.finishJob = jest.fn().mockResolvedValue(null);
    repo.patchJob = jest.fn().mockResolvedValue(null);
  });

  it('runs all pipeline steps and returns succeeded (sync)', async () => {
    const out = await service.run(1, { async: false }, 'sp@test.vn');
    expect(out.status).toBe('succeeded');
    if ('output' in out && out.output) {
      expect(out.output.child_jobs).toHaveLength(4);
    }
    expect(planner.runStrategyJob).toHaveBeenCalled();
    expect(repo.finishJob).toHaveBeenCalled();
    expect(worker.triggerJob).not.toHaveBeenCalled();
  });

  it('enqueues async job when flag on', async () => {
    asyncEnabled = true;
    repo.createJob = jest.fn().mockResolvedValue({ id: 100, status: 'pending', input_json: {} });
    const out = await service.run(1, {}, 'sp@test.vn');
    expect(out.status).toBe('pending');
    expect(out.job_id).toBe(100);
    expect(repo.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', job_type: 'multi_agent' }),
    );
    expect(worker.triggerJob).toHaveBeenCalledWith(100);
    expect(planner.runStrategyJob).not.toHaveBeenCalled();
  });

  it('returns 409 conflict when parent already running', async () => {
    repo.listJobs = jest.fn().mockResolvedValue([
      { id: 50, job_type: 'multi_agent', status: 'running' },
    ]);
    await expect(service.run(1, { async: false }, 'sp@test.vn')).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns partial when a middle step fails', async () => {
    planner.runCampaignJob = jest
      .fn()
      .mockRejectedValue(new ServiceUnavailableException({ job_id: 22, message: 'fail' }));
    const out = await service.run(1, { async: false }, 'sp@test.vn');
    expect(out.status).toBe('partial');
    if ('output' in out && out.output) {
      expect(out.output.failed_step).toBe('planner');
      expect(out.output.child_jobs).toHaveLength(2);
    }
  });

  it('getStatus derives step states from latest parent job', async () => {
    repo.listJobs = jest.fn().mockResolvedValue([
      {
        id: 99,
        job_type: 'multi_agent',
        status: 'succeeded',
        input_json: { steps: ['strategist', 'planner', 'copywriter', 'analyst'] },
        output_json: {
          pipeline_key: 'default_v1',
          playbook_slug: 'meta-lead-gen',
          child_jobs: [
            { step: 'strategist', job_id: 11, status: 'succeeded' },
            { step: 'planner', job_id: 12, status: 'failed' },
          ],
          failed_step: 'planner',
          quality_score: 55,
        },
      },
    ]);
    const status = await service.getStatus(1);
    expect(status.rollup_status).toBe('partial');
    expect(status.steps[0].state).toBe('succeeded');
    expect(status.steps[1].state).toBe('failed');
    expect(status.progress_pct).toBe(100);
  });

  it('getStatus reports running progress for pending parent', async () => {
    repo.listJobs = jest.fn().mockResolvedValue([
      {
        id: 101,
        job_type: 'multi_agent',
        status: 'running',
        input_json: { steps: ['strategist', 'planner'] },
        output_json: {
          pipeline_key: 'default_v1',
          child_jobs: [{ step: 'strategist', job_id: 11, status: 'succeeded' }],
        },
      },
    ]);
    const status = await service.getStatus(1);
    expect(status.rollup_status).toBe('running');
    expect(status.parent_status).toBe('running');
    expect(status.current_step).toBe('planner');
    expect(status.progress_pct).toBeGreaterThan(0);
    expect(status.progress_pct).toBeLessThan(100);
  });
});
