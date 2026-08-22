import { AiExecutionService } from './ai-execution.service';

describe('AiExecutionService', () => {
  const leadScore = {
    scoreLead: jest.fn().mockResolvedValue({
      data: { score: 72 },
      meta: { request_id: 'req-1' },
      errors: [],
    }),
  };

  const summarizeService = {
    summarize: jest.fn().mockResolvedValue({
      data: { summary: 'ok' },
      meta: { request_id: 'req-2' },
      errors: [],
    }),
  };

  const timeline = { buildAiContext: jest.fn() };

  let execution: AiExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    execution = new AiExecutionService(
      leadScore as never,
      summarizeService as never,
      timeline as never,
    );
  });

  it('scoreLead delegates to AiLeadScoreService', async () => {
    await execution.scoreLead({ actorId: 'staff-1' }, 99);
    expect(leadScore.scoreLead).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 99, actorId: 'staff-1' }),
    );
  });

  it('summarize delegates to AiSummarizeService', async () => {
    await execution.summarize({ context: 'activity', text: 'x'.repeat(60) });
    expect(summarizeService.summarize).toHaveBeenCalled();
  });
});
