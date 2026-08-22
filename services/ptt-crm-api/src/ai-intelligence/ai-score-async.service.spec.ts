import { AiScoreAsyncService } from './ai-score-async.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { JobQueueRepository } from '../webhooks/job-queue.repository';

describe('AiScoreAsyncService', () => {
  const jobQueue = {
    enqueueScoreLeadJob: jest.fn(),
  } as unknown as JobQueueRepository;

  const aiConfig = {
    scoreAsync: true,
  } as AiIntelligenceConfigService;

  let service: AiScoreAsyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiScoreAsyncService(jobQueue, aiConfig);
  });

  it('skips enqueue when PTT_AI_SCORE_ASYNC disabled', async () => {
    const disabled = new AiScoreAsyncService(jobQueue, {
      scoreAsync: false,
    } as AiIntelligenceConfigService);
    const out = await disabled.enqueueAfterLeadCreated({ leadId: 42 });
    expect(out).toBeNull();
    expect(jobQueue.enqueueScoreLeadJob).not.toHaveBeenCalled();
  });

  it('enqueues score_lead when async enabled', async () => {
    (jobQueue.enqueueScoreLeadJob as jest.Mock).mockResolvedValue({
      id: 'job-1',
      created: true,
    });
    const out = await service.enqueueAfterLeadCreated({
      leadId: 99,
      clientId: '00000000-0000-4000-8000-000000000001',
      correlationId: 'corr-1',
    });
    expect(out?.created).toBe(true);
    expect(jobQueue.enqueueScoreLeadJob).toHaveBeenCalledWith({
      leadId: 99,
      clientId: '00000000-0000-4000-8000-000000000001',
      correlationId: 'corr-1',
    });
  });

  it('returns null when queue throws', async () => {
    (jobQueue.enqueueScoreLeadJob as jest.Mock).mockRejectedValue(new Error('pg down'));
    const out = await service.enqueueAfterLeadCreated({ leadId: 1 });
    expect(out).toBeNull();
  });
});
