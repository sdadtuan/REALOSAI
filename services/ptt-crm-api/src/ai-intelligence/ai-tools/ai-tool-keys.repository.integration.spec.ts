import { AppConfigService } from '../../config/app-config.service';
import { AiToolKeysRepository } from './ai-tool-keys.repository';

const dbUrl = process.env.DATABASE_URL ?? '';
const integration = dbUrl.includes('rnosaidb') ? describe : describe.skip;

integration('AiToolKeysRepository (RNOS-33 PG integration)', () => {
  let repo: AiToolKeysRepository;
  const cleanup: string[] = [];

  beforeAll(() => {
    const config = { databaseUrl: dbUrl } as AppConfigService;
    repo = new AiToolKeysRepository(config);
  });

  afterAll(async () => {
    for (const id of cleanup) {
      await repo['db'].query('DELETE FROM ai_tool_api_keys WHERE id = $1::uuid', [id]);
    }
    await repo.onModuleDestroy();
  });

  it('creates key, validates, lists, and revokes', async () => {
    expect(await repo.tableReady()).toBe(true);
    expect(await repo.migrationVersion()).toBe('2026-07-27-rnos33-ai-tools');

    const created = await repo.create(
      'rnos33-probe',
      ['health_check'],
      null,
      'rnos33-integration',
    );
    cleanup.push(created.id);
    expect(created.plaintextKey.startsWith('ptt_ai_')).toBe(true);
    expect(created.keyPrefix).toBe(created.plaintextKey.slice(0, 12));

    const validated = await repo.validateKey(created.plaintextKey);
    expect(validated?.id).toBe(created.id);
    expect(validated?.allowed_tools).toEqual(['health_check']);

    const listed = await repo.listKeys();
    expect(listed.some((row) => row.id === created.id)).toBe(true);
    expect(listed.find((row) => row.id === created.id)?.key_prefix).toBe(created.keyPrefix);

    await repo.revoke(created.id);
    expect(await repo.validateKey(created.plaintextKey)).toBeNull();
  });
});
