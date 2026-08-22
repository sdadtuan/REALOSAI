import { AI_USE_CASE } from '../ai-audit.constants';
import { OrchestratorEngine } from './orchestrator.engine';
import { OrchestratorService } from './orchestrator.service';

describe('OrchestratorService', () => {
  const config = { orchestratorEnabled: true };
  const repository = {
    tableReady: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 'orch-1' }),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    getOrchestration: jest.fn(),
    list: jest.fn(),
  };
  const runs = {
    insertRun: jest.fn().mockResolvedValue({ id: 'parent-1' }),
    updateRun: jest.fn().mockResolvedValue(undefined),
    listByOrchestration: jest.fn(),
  };
  const registry = {
    get: jest.fn(),
  };
  const audit = {
    newRequestId: jest.fn().mockReturnValue('request-1'),
    assertAuditReady: jest.fn().mockResolvedValue(undefined),
    redactPayload: jest.fn((value: Record<string, unknown>) => {
      const redacted = { ...value };
      if ('secret' in redacted) redacted.secret = '[REDACTED]';
      return redacted;
    }),
    wrap: jest.fn(),
  };

  let service: OrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockResolvedValue({ id: 'orch-1' });
    runs.insertRun.mockResolvedValue({ id: 'parent-1' });
    audit.newRequestId.mockReturnValue('request-1');
    audit.redactPayload.mockImplementation((value: Record<string, unknown>) => {
      const redacted = { ...value };
      if ('secret' in redacted) redacted.secret = '[REDACTED]';
      return redacted;
    });
    let childRun = 0;
    audit.wrap.mockImplementation(async (_ctx, fn) => {
      const result = await fn({ runId: '', requestId: 'request-1' });
      childRun += 1;
      return {
        data: result.data,
        runId: `child-${childRun}`,
        requestId: 'request-1',
        latencyMs: 1,
      };
    });

    const engine = new OrchestratorEngine(registry as never, audit as never);
    service = new OrchestratorService(
      config as never,
      repository as never,
      runs as never,
      engine,
      audit as never,
    );
  });

  it('runs a two-step plan sequentially and completes its audit tree', async () => {
    const order: string[] = [];
    const scoreHandler = jest.fn().mockImplementation(async () => {
      order.push('score_lead');
      return { data: { score: 72 }, meta: { request_id: 'score-1' }, errors: [] };
    });
    const routeHandler = jest.fn().mockImplementation(async () => {
      order.push('route_rep');
      return { data: { routed: true }, meta: { request_id: 'route-1' }, errors: [] };
    });
    registry.get.mockImplementation((key: string) =>
      key === 'score_lead'
        ? { agentName: 'lead-qualification', useCase: AI_USE_CASE.SCORE_LEAD, handler: scoreHandler }
        : { agentName: 'lead-routing', useCase: AI_USE_CASE.ROUTE_REP, handler: routeHandler },
    );

    const result = await service.run({
      planKey: 'lead_intake_v1',
      clientId: 'client-1',
      input: { entityType: 'lead', entityId: '42', leadId: 42 },
      actorId: 'staff-1',
      correlationId: 'corr-1',
    });

    expect(order).toEqual(['score_lead', 'route_rep']);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        planKey: 'lead_intake_v1',
        status: 'running',
      }),
    );
    expect(runs.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'orchestrator',
        useCase: AI_USE_CASE.ORCHESTRATION_RUN,
        orchestrationId: 'orch-1',
        status: 'running',
      }),
    );
    expect(audit.wrap).toHaveBeenCalledTimes(2);
    expect(audit.wrap).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        useCase: AI_USE_CASE.ORCHESTRATION_STEP,
        parentRunId: 'parent-1',
        orchestrationId: 'orch-1',
        stepKey: 'score_lead',
        stepIndex: 0,
      }),
      expect.any(Function),
    );
    expect(runs.updateRun).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(repository.updateStatus).toHaveBeenCalledWith(
      'orch-1',
      'succeeded',
      expect.objectContaining({ completed_steps: 2 }),
    );
    expect(result.data).toMatchObject({
      orchestration_id: 'orch-1',
      parent_run_id: 'parent-1',
      status: 'succeeded',
    });
    expect(result.data.steps).toHaveLength(2);
  });

  it('aborts after a required step fails and marks the parent and orchestration failed', async () => {
    const scoreHandler = jest.fn().mockRejectedValue(new Error('scoring unavailable'));
    registry.get.mockImplementation((key: string) => {
      if (key === 'score_lead') {
        return {
          agentName: 'lead-qualification',
          useCase: AI_USE_CASE.SCORE_LEAD,
          handler: scoreHandler,
        };
      }
      throw new Error(`unexpected step: ${key}`);
    });

    await expect(
      service.run({
        planKey: 'lead_intake_v1',
        input: { entityType: 'lead', entityId: '42', leadId: 42 },
        actorId: 'staff-1',
        correlationId: 'corr-2',
      }),
    ).rejects.toThrow('scoring unavailable');

    expect(registry.get).toHaveBeenCalledTimes(1);
    expect(runs.updateRun).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'scoring unavailable',
      }),
    );
    expect(repository.updateStatus).toHaveBeenCalledWith(
      'orch-1',
      'failed',
      expect.objectContaining({
        failed_step: 'score_lead',
        error: 'scoring unavailable',
      }),
    );
  });

  it('redacts persisted input and nested step output', async () => {
    registry.get.mockImplementation((key: string) => ({
      agentName: key,
      useCase: AI_USE_CASE.ORCHESTRATION_STEP,
      handler: jest.fn().mockResolvedValue({
        data: { result: key, secret: `${key}-secret` },
        meta: { request_id: `${key}-request` },
        errors: [],
      }),
    }));

    await service.run({
      planKey: 'lead_intake_v1',
      input: {
        entityType: 'lead',
        entityId: '42',
        leadId: 42,
        secret: 'input-secret',
      },
      correlationId: 'corr-redaction',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        inputJson: expect.objectContaining({ secret: '[REDACTED]' }),
      }),
    );
    expect(runs.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        inputJson: expect.any(Object),
      }),
    );
    expect(audit.redactPayload).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'score_lead', secret: 'score_lead-secret' }),
    );
    expect(runs.updateRun).toHaveBeenCalledWith(
      'parent-1',
      expect.objectContaining({
        outputJson: expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ secret: '[REDACTED]' }),
            }),
          ]),
        }),
      }),
    );
  });

  it('marks the orchestration failed when parent run creation fails', async () => {
    runs.insertRun.mockRejectedValueOnce(new Error('parent insert failed'));

    await expect(
      service.run({
        planKey: 'lead_intake_v1',
        input: { entityType: 'lead', entityId: '42', leadId: 42 },
        correlationId: 'corr-parent-failure',
      }),
    ).rejects.toThrow('parent insert failed');

    expect(repository.updateStatus).toHaveBeenCalledWith(
      'orch-1',
      'failed',
      expect.objectContaining({
        failed_step: 'orchestrator',
        error: 'parent insert failed',
      }),
    );
  });
});
