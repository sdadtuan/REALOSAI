import { AppConfigService } from '../config/app-config.service';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';

const dbUrl = process.env.DATABASE_URL ?? '';
const integration = dbUrl.includes('rnosaidb') ? describe : describe.skip;

integration('AiAgentRunsRepository (RNOS-05 PG integration)', () => {
  let repo: AiAgentRunsRepository;

  beforeAll(() => {
    repo = new AiAgentRunsRepository({ databaseUrl: dbUrl } as AppConfigService);
  });

  afterAll(async () => {
    await repo.onModuleDestroy();
  });

  it('smokeInsertAndDelete on ai_agent_runs', async () => {
    const ready = await repo.tableReady();
    expect(ready).toBe(true);
    await expect(repo.smokeInsertAndDelete()).resolves.toBe(true);
  });
});
