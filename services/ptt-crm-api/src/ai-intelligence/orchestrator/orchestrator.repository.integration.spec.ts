import { AppConfigService } from '../../config/app-config.service';
import { AiAgentRunsRepository } from '../ai-agent-runs.repository';
import { OrchestratorRepository } from './orchestrator.repository';

const dbUrl = process.env.DATABASE_URL ?? '';
const integration = dbUrl.includes('rnosaidb') ? describe : describe.skip;

integration('OrchestratorRepository (RNOS-31 PG integration)', () => {
  let runsRepo: AiAgentRunsRepository;
  let repo: OrchestratorRepository;
  const cleanup: { orchestrationIds: string[]; runIds: string[] } = {
    orchestrationIds: [],
    runIds: [],
  };

  beforeAll(() => {
    const config = { databaseUrl: dbUrl } as AppConfigService;
    runsRepo = new AiAgentRunsRepository(config);
    repo = new OrchestratorRepository(config, runsRepo);
  });

  afterAll(async () => {
    for (const runId of [...cleanup.runIds].reverse()) {
      await runsRepo['db'].query('DELETE FROM ai_agent_runs WHERE id = $1::uuid', [runId]);
    }
    for (const orchestrationId of cleanup.orchestrationIds) {
      await repo['db'].query('DELETE FROM ai_orchestrations WHERE id = $1::uuid', [orchestrationId]);
    }
    await repo.onModuleDestroy();
    await runsRepo.onModuleDestroy();
  });

  it('creates orchestration with parent run and two child runs', async () => {
    expect(await repo.tableReady()).toBe(true);
    expect(await repo.migrationVersion()).toBe('2026-07-27-rnos31-orchestrator');

    const orchestration = await repo.create({
      triggerType: 'manual',
      planKey: 'lead_intake_v1',
      inputJson: { entity_type: 'lead', entity_id: 'rnos31-probe' },
      correlationId: 'rnos31-probe-corr',
    });
    cleanup.orchestrationIds.push(orchestration.id);
    expect(orchestration.id).toBeTruthy();

    const parentRun = await runsRepo.insertRun({
      agentName: 'orchestrator',
      useCase: 'orchestration_run',
      status: 'running',
      orchestrationId: orchestration.id,
      inputJson: { plan_key: 'lead_intake_v1' },
    });
    cleanup.runIds.push(parentRun.id);

    const childOne = await repo.insertChildRun({
      parentRunId: parentRun.id,
      orchestrationId: orchestration.id,
      stepKey: 'score_lead',
      stepIndex: 0,
      agentName: 'lead-qualification',
      useCase: 'score_lead',
      status: 'succeeded',
      inputJson: { probe: true },
      outputJson: { score: 72 },
      latencyMs: 12,
    });
    cleanup.runIds.push(childOne.id);

    const childTwo = await repo.insertChildRun({
      parentRunId: parentRun.id,
      orchestrationId: orchestration.id,
      stepKey: 'route_rep',
      stepIndex: 1,
      agentName: 'lead-routing',
      useCase: 'route_rep',
      status: 'succeeded',
      inputJson: { probe: true },
      outputJson: { routed: true },
      latencyMs: 8,
    });
    cleanup.runIds.push(childTwo.id);

    const loaded = await repo.getOrchestration(orchestration.id);
    expect(loaded?.plan_key).toBe('lead_intake_v1');
    expect(loaded?.status).toBe('running');

    const children = await repo.listChildren(parentRun.id);
    expect(children).toHaveLength(2);
    expect(children.map((row) => row.step_key)).toEqual(['score_lead', 'route_rep']);
    expect(children.every((row) => row.orchestration_id === orchestration.id)).toBe(true);
    expect(children.every((row) => row.parent_run_id === parentRun.id)).toBe(true);
  });
});
