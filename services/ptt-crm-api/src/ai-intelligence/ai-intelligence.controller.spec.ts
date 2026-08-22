import { AiIntelligenceController } from './ai-intelligence.controller';

describe('AiIntelligenceController orchestrator cron', () => {
  const cron = {
    runDailyRetainHealth: jest.fn(),
    cronStatus: jest.fn(),
  };
  const controller = Object.create(AiIntelligenceController.prototype) as AiIntelligenceController;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(controller, { orchestratorCron: cron });
  });

  it('delegates retain-health cron pagination and internal audit context', async () => {
    cron.runDailyRetainHealth.mockResolvedValue({ ok: true });

    await (controller as never as {
      runOrchestratorRetainHealthCron: (
        body: { limit?: number; offset?: number },
        req: object,
        requestId?: string,
        correlationId?: string,
      ) => Promise<unknown>;
    }).runOrchestratorRetainHealthCron(
      { limit: 25, offset: 50 },
      { staffAuthVia: 'internal' },
      'request-id',
      'correlation-id',
    );

    expect(cron.runDailyRetainHealth).toHaveBeenCalledWith({
      limit: 25,
      offset: 50,
      actorId: 'system',
      correlationId: 'correlation-id',
    });
  });

  it('returns orchestrator cron status', () => {
    cron.cronStatus.mockReturnValue({ ok: true });

    expect(
      (controller as never as { getOrchestratorCronStatus: () => unknown })
        .getOrchestratorCronStatus(),
    ).toEqual({ ok: true });
  });
});
