import { PortalResearchRepository } from './portal-research.repository';

describe('PortalResearchRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  function repoWithMock(): PortalResearchRepository {
    const repo = new PortalResearchRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('listPortalVisibleVersions filters portal_visible and p.client_id without title', async () => {
    const repo = repoWithMock();
    await repo.listPortalVisibleVersions('550e8400-e29b-41d4-a716-446655440000');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/portal_visible = true/);
    expect(sql).toMatch(/p\.client_id = \$1/);
    expect(sql).not.toMatch(/p\.title/);
    expect(sql).not.toMatch(/ADD COLUMN/);
  });

  it('getPortalReportVersion selects client_id without project title', async () => {
    const repo = repoWithMock();
    await repo.getPortalReportVersion(42);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/p\.client_id/);
    expect(sql).toMatch(/WHERE v\.id = \$1/);
    expect(sql).not.toMatch(/p\.title/);
  });

  it('listPublishedEmbeddings binds jwt client and published status only', async () => {
    const repo = repoWithMock();
    await repo.listPublishedEmbeddings('acme', 'PRICE');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/i\.status = 'published'/);
    expect(sql).toMatch(/i\.valid_to/);
    expect(queryMock.mock.calls[0][1][0]).toBe('acme');
    expect(sql).not.toMatch(/approved_client_facing/);
  });

  it('P20 listPublishedEmbeddingsByVec uses published corpus and <=> ordering', async () => {
    const repo = repoWithMock();
    await repo.listPublishedEmbeddingsByVec('acme', 'PRICE', [1, 0], 50);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/i\.status = 'published'/);
    expect(sql).toMatch(/embedding_vec <=> \$/);
    expect(sql).toMatch(/vector_dims\(e\.embedding_vec\)/);
    expect(sql).not.toMatch(/approved_client_facing/);
  });

  it('P15 getThemeQuarterAnalytics scopes published corpus and jwt client_id', async () => {
    const repo = repoWithMock();
    await repo.getThemeQuarterAnalytics('acme', 2026);
    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toMatch(/i\.status = 'published'/);
    expect(text).not.toMatch(/approved_client_facing/);
    expect(text).not.toMatch(/\btitle\b/);
    expect(text).toMatch(/date_trunc\('quarter', i\.updated_at\)/);
    expect(text).toMatch(/p\.client_id = \$1/);
    expect(text).toMatch(/EXTRACT\(YEAR FROM i\.updated_at\) = \$2/);
    expect(params).toEqual(['acme', 2026]);
  });

  it('P24 listPublishedInsightValidTo filters published and client_id', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.listPublishedInsightValidTo('acme', [11, 12]);
    const sql = String(queryMock.mock.calls[0][0]);
    const binds = queryMock.mock.calls[0][1];
    expect(sql).toMatch(/i\.status = 'published'/);
    expect(sql).toMatch(/p\.client_id = \$1/);
    expect(sql).toMatch(/i\.id = ANY/);
    expect(binds[0]).toBe('acme');
  });

  it('P24 listPublishedInsightValidTo skips SQL when ids empty', async () => {
    const repo = repoWithMock();
    const out = await repo.listPublishedInsightValidTo('acme', []);
    expect(out.size).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('P35 getLatestCjSummaryForClient scopes PRICE_OFFER and jwt client_id without title or created_by', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          n: 8,
          n_choices: 8,
          attributes: [{ name: 'price', levels: [{ label: '99k', count: 2, share_pct: 25 }], top_level: '99k' }],
          recommendation: { levels: [{ attribute: 'price', level: '99k', share_pct: 25 }] },
          limitation_note: 'note',
          statistical_inference: false,
        },
      ],
    });
    const repo = repoWithMock();
    const out = await repo.getLatestCjSummaryForClient('acme');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/crm_research_cj_summaries/);
    expect(sql).toMatch(/p\.client_id = \$1/);
    expect(sql).toMatch(/p\.product_type = 'PRICE_OFFER'/);
    expect(sql).toMatch(/ORDER BY s\.id DESC/);
    expect(sql).not.toMatch(/p\.title/);
    expect(sql).not.toMatch(/created_by/);
    expect(sql).not.toMatch(/ADD COLUMN/);
    expect(queryMock.mock.calls[0][1]).toEqual(['acme']);
    expect(out).toMatchObject({ n: 8, n_choices: 8, statistical_inference: false });
    expect(out).not.toHaveProperty('created_by');
    expect(out).not.toHaveProperty('title');
  });

  it('P35 getLatestCjSummaryForClient returns null when empty', async () => {
    const repo = repoWithMock();
    const out = await repo.getLatestCjSummaryForClient('acme');
    expect(out).toBeNull();
  });
});
