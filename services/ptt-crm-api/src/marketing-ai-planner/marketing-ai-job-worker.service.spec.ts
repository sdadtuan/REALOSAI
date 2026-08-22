import { AppConfigService } from '../config/app-config.service';
import { MarketingAiJobWorkerService } from './marketing-ai-job-worker.service';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';

describe('MarketingAiJobWorkerService', () => {
  const config = {
    mktAiMultiAgentAsync: true,
  } as AppConfigService;

  const repo = {
    listPendingMultiAgentJobs: jest.fn(),
    claimPendingMultiAgentJob: jest.fn(),
    finishJob: jest.fn(),
  } as unknown as MarketingAiPlannerRepository;

  const multiAgent = {
    isEnabled: jest.fn().mockReturnValue(true),
    executePipeline: jest.fn().mockResolvedValue(undefined),
  } as unknown as MarketingAiMultiAgentService;

  let worker: MarketingAiJobWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new MarketingAiJobWorkerService(config, repo, multiAgent);
  });

  it('claims pending job and executes pipeline', async () => {
    repo.listPendingMultiAgentJobs = jest.fn().mockResolvedValue([{ id: 7 }]);
    repo.claimPendingMultiAgentJob = jest.fn().mockResolvedValue({ id: 7, status: 'running' });
    await worker.tick();
    expect(repo.claimPendingMultiAgentJob).toHaveBeenCalledWith(7);
    expect(multiAgent.executePipeline).toHaveBeenCalledWith(7);
  });

  it('triggerJob runs single job immediately', async () => {
    repo.claimPendingMultiAgentJob = jest.fn().mockResolvedValue({ id: 8, status: 'running' });
    worker.triggerJob(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(multiAgent.executePipeline).toHaveBeenCalledWith(8);
  });

  it('skips when claim fails (already taken)', async () => {
    repo.claimPendingMultiAgentJob = jest.fn().mockResolvedValue(null);
    worker.triggerJob(9);
    await new Promise((r) => setTimeout(r, 10));
    expect(multiAgent.executePipeline).not.toHaveBeenCalled();
  });
});
