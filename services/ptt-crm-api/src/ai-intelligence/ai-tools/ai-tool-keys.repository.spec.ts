import { createHash } from 'crypto';
import { AiToolKeysRepository } from './ai-tool-keys.repository';

describe('AiToolKeysRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): AiToolKeysRepository {
    const repo = new AiToolKeysRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  it('create stores hash and returns plaintext key once', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'key-uuid-1' }] });
    const repo = repoWithMock();

    const result = await repo.create(
      'integration-bot',
      ['health_check', 'list_leads'],
      'client-uuid',
      'staff-42',
    );

    expect(result.id).toBe('key-uuid-1');
    expect(result.plaintextKey.startsWith('ptt_ai_')).toBe(true);
    expect(result.keyPrefix).toBe(result.plaintextKey.slice(0, 12));

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_tool_api_keys'),
      expect.arrayContaining([
        'integration-bot',
        result.keyPrefix,
        createHash('sha256').update(result.plaintextKey).digest('hex'),
        'client-uuid',
        JSON.stringify(['health_check', 'list_leads']),
        'staff-42',
      ]),
    );
  });

  it('validateKey returns null for wrong prefix', async () => {
    const repo = repoWithMock();
    const result = await repo.validateKey('bad_prefix_secret');
    expect(result).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('validateKey hashes plaintext and queries active key', async () => {
    const plaintext = 'ptt_ai_testsecret123';
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 'key-uuid-2',
          name: 'probe',
          key_prefix: plaintext.slice(0, 12),
          client_id: null,
          allowed_tools: ['health_check'],
          rate_limit_per_min: 60,
          is_active: true,
          created_by: 'staff-1',
          created_at: '2026-07-27T00:00:00.000Z',
          revoked_at: null,
        },
      ],
    });
    const repo = repoWithMock();

    const result = await repo.validateKey(plaintext);

    expect(result?.id).toBe('key-uuid-2');
    expect(result?.allowed_tools).toEqual(['health_check']);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('key_hash = $1'),
      [createHash('sha256').update(plaintext).digest('hex')],
    );
  });

  it('revoke deactivates key by id', async () => {
    queryMock.mockResolvedValue({ rowCount: 1 });
    const repo = repoWithMock();

    await repo.revoke('key-uuid-3');

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('SET is_active = false'),
      ['key-uuid-3'],
    );
  });

  it('listKeys returns mapped rows ordered by created_at desc', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 'key-a',
          name: 'a',
          key_prefix: 'ptt_ai_aaaa',
          client_id: null,
          allowed_tools: [],
          rate_limit_per_min: 60,
          is_active: true,
          created_by: null,
          created_at: '2026-07-27T01:00:00.000Z',
          revoked_at: null,
        },
      ],
    });
    const repo = repoWithMock();

    const rows = await repo.listKeys();

    expect(rows).toHaveLength(1);
    expect(rows[0].key_prefix).toBe('ptt_ai_aaaa');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'));
  });

  it('records every tool call in the dedicated audit table', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'log-1' }] });
    const repo = repoWithMock();

    await expect(
      repo.recordCall({
        apiKeyId: 'key-a',
        toolName: 'health_check',
        inputJson: {},
        outputJson: { status: 'ok' },
        status: 'succeeded',
        latencyMs: 5,
      }),
    ).resolves.toBe('log-1');

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_tool_call_log'),
      [
        'key-a',
        'health_check',
        JSON.stringify({}),
        JSON.stringify({ status: 'ok' }),
        'succeeded',
        5,
        null,
      ],
    );
  });
});
