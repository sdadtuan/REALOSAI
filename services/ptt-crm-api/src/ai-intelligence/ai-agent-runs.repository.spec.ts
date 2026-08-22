import { AiAgentRunsRepository } from './ai-agent-runs.repository';

describe('AiAgentRunsRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): AiAgentRunsRepository {
    const repo = new AiAgentRunsRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  it('insertRun sends client_id and token_usage', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'uuid-1' }] });
    const repo = repoWithMock();

    const row = await repo.insertRun({
      agentName: 'ai-intelligence',
      useCase: 'summarize',
      clientId: 'client-1',
      status: 'succeeded',
      tokenUsage: { total_tokens: 42 },
      inputJson: { entity_id: 'L1' },
      outputJson: { ok: true },
    });

    expect(row.id).toBe('uuid-1');
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('token_usage'),
      expect.arrayContaining(['client-1', 'ai-intelligence', 'summarize']),
    );
  });

  it('listRuns builds filters', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    const repo = repoWithMock();
    const result = await repo.listRuns({
      useCase: 'score_lead',
      entityId: 'L1',
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(queryMock).toHaveBeenCalledTimes(2);
    const listSql = String(queryMock.mock.calls[1][0]);
    expect(listSql).toContain("input_json->>'entity_id'");
  });
});
