import { Pool } from 'pg';
import { DealScoreContextRepository } from './deal-score-context.repository';

jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

describe('DealScoreContextRepository', () => {
  const PoolMock = Pool as unknown as jest.Mock;

  beforeEach(() => {
    PoolMock.mockReset();
  });

  it('maps legacy case id from PG row', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            pg_id: 99,
            legacy_id: 42,
            title: 'Deal A',
            pipeline_stage: 'moi',
            stage_entered_at: '2026-07-01T00:00:00Z',
            updated_at: '2026-07-10T00:00:00Z',
            status: 'moi',
            deal_value_vnd: 1_000_000,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ n7: '2', last_at: '2026-07-09T12:00:00Z' }],
      });
    PoolMock.mockImplementation(() => ({ query }));

    const crmConfig = {
      resolvePipelineRuntime: jest.fn().mockResolvedValue({
        terminalStages: new Set(['won', 'lost']),
      }),
    };
    const repo = new DealScoreContextRepository(
      { databaseUrl: 'postgres://test' } as never,
      crmConfig as never,
    );

    const ctx = await repo.loadDealScoreContext(42);
    expect(ctx?.dealId).toBe(42);
    expect(ctx?.title).toBe('Deal A');
    expect(ctx?.activityCount7d).toBe(2);
    expect(ctx?.isTerminal).toBe(false);
  });

  it('returns null when case missing', async () => {
    PoolMock.mockImplementation(() => ({
      query: jest.fn().mockResolvedValueOnce({ rows: [] }),
    }));
    const repo = new DealScoreContextRepository(
      { databaseUrl: 'postgres://test' } as never,
      { resolvePipelineRuntime: jest.fn() } as never,
    );

    await expect(repo.loadDealScoreContext(404)).resolves.toBeNull();
  });
});
