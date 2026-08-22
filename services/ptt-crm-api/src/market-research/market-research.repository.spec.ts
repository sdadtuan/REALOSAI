import { MarketResearchRepository } from './market-research.repository';

describe('MarketResearchRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): MarketResearchRepository {
    const repo = new MarketResearchRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  it('sumTavilyCredits includes desk_tavily, deep_research, research_triangulate, and research_pulse', async () => {
    queryMock.mockResolvedValue({ rows: [{ n: 3 }] });
    const repo = repoWithMock();

    const n = await repo.sumTavilyCredits(9);

    expect(n).toBe(3);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toContain('desk_tavily');
    expect(sql).toContain('deep_research');
    expect(sql).toContain('research_triangulate');
    expect(sql).toContain('research_pulse');
    expect(sql).toMatch(
      /job_type IN \('desk_tavily',\s*'deep_research',\s*'research_triangulate',\s*'research_pulse'\)/,
    );
  });

  it('listProjects filters by lifecycle_id', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listProjects({ lifecycle_id: 12 });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/p\.lifecycle_id = \$1/);
    expect(params).toContain(12);
  });

  it('findConsultFormDataByClientId joins consult tasks via contract agency_client_id', async () => {
    queryMock.mockResolvedValue({
      rows: [{ form_data: { industry: 'Sữa uống', top_competitors: 'Vinamilk' } }],
    });
    const repo = repoWithMock();

    const form = await repo.findConsultFormDataByClientId('acme');

    expect(form).toEqual({ industry: 'Sữa uống', top_competitors: 'Vinamilk' });
    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/crm_svc_tasks/);
    expect(sql).toMatch(/crm_service_lifecycle/);
    expect(sql).toMatch(/crm_contracts/);
    expect(sql).toMatch(/agency_client_id/);
    expect(sql).toMatch(/t\.stage = 'consult'/);
    expect(params).toEqual(['acme']);
  });

  it('findConsultFormDataByClientId returns null when no consult row', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    expect(await repo.findConsultFormDataByClientId('acme')).toBeNull();
  });

  it('listEmbeddings filters theme_code by code or synonym case-insensitively', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listEmbeddings({ theme_code: 'Pricing' });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/lower\(t2\.theme_code\) = lower\(\$\d+\)/);
    expect(sql).toMatch(/unnest\(t2\.synonyms\)/);
    expect(sql).toMatch(/theme_synonyms/);
    expect(params).toContain('Pricing');
  });

  it('P22 listEmbeddings selects valid_to', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.listEmbeddings({ client_id: 'acme' });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/i\.valid_to/);
    expect(sql).toMatch(/GROUP BY.*i\.valid_to/s);
  });

  it('P29 listInsightValidToForProject filters project_id', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 11, valid_to: '2020-01-01' }] });
    const repo = repoWithMock();
    const out = await repo.listInsightValidToForProject(9, [11, 12]);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/i\.project_id = \$1/);
    expect(sql).toMatch(/i\.id = ANY\(\$2::int\[\]\)/);
    expect(out.get(11)).toBe('2020-01-01');
  });

  it('P29 listInsightValidToForProject skips SQL when ids empty', async () => {
    const repo = repoWithMock();
    const out = await repo.listInsightValidToForProject(9, []);
    expect(queryMock).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('P20 upsertInsightEmbedding writes embedding_vec when write_vec', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.upsertInsightEmbedding({
      insight_id: 1,
      project_id: 9,
      embedding: [1, 0],
      embed_text: 'Giá',
      embed_model: 'local-hash',
      embed_dims: 2,
      write_vec: true,
    });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/embedding_vec/);
    expect(queryMock.mock.calls[0][1]).toContain('[1,0]');
  });

  it('P20 upsertInsightEmbedding skips embedding_vec when write_vec false', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.upsertInsightEmbedding({
      insight_id: 1,
      project_id: 9,
      embedding: [1, 0],
      embed_text: 'Giá',
      embed_model: 'local-hash',
      embed_dims: 2,
    });
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).not.toMatch(/embedding_vec/);
  });

  it('P20 listEmbeddingsByVec orders by <=> and filters same dims', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.listEmbeddingsByVec({ client_id: 'acme' }, [1, 0], 50);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/embedding_vec <=> \$/);
    expect(sql).toMatch(/vector_dims\(e\.embedding_vec\)/);
    expect(sql).toMatch(/p\.client_id = \$/);
  });

  it('getOpsAnalytics scopes SQL to allowedClientIds and never selects title', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getOpsAnalytics({}, ['beta']);

    expect(queryMock).toHaveBeenCalled();
    for (const [sql, params] of queryMock.mock.calls) {
      const text = String(sql);
      expect(text).not.toMatch(/\btitle\b/);
      expect(text).not.toMatch(/marketing.?plan/i);
      expect(text).toMatch(/p\.client_id = ANY\(\$\d+::text\[\]\)/);
      expect(params).toContainEqual(['beta']);
    }
    const cycleSql = String(queryMock.mock.calls[0][0]);
    expect(cycleSql).toMatch(/EXTRACT\(EPOCH FROM \(p\.updated_at - p\.created_at\)\)\/3600/);
    expect(cycleSql).toMatch(/p\.status IN \('approved','distributed'\)/);
    const verifiedSql = String(queryMock.mock.calls[2][0]);
    expect(verifiedSql).toMatch(/qc_status = 'verified'/);
    expect(verifiedSql).toMatch(/COUNT\(DISTINCT e\.project_id\)/);
    const versionsSql = String(queryMock.mock.calls[4][0]);
    expect(versionsSql).toMatch(/crm_research_report_versions/);
    expect(versionsSql).toMatch(/crm_research_reports/);
    const listSql = String(queryMock.mock.calls[5][0]);
    expect(listSql).toMatch(/verified_ev/);
    expect(listSql).toMatch(/p\.id/);
    expect(listSql).toMatch(/p\.client_id/);
    expect(listSql).toMatch(/p\.status/);
  });

  it('getThemeQuarterAnalytics scopes corpus, year, and client tenancy', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getThemeQuarterAnalytics({ year: 2026 }, ['beta']);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).not.toMatch(/\btitle\b/);
    expect(text).toMatch(/approved_client_facing/);
    expect(text).toMatch(/published/);
    expect(text).toMatch(/date_trunc\('quarter', i\.updated_at\)/);
    expect(text).toMatch(/crm_research_insight_themes/);
    expect(text).toMatch(/crm_research_taxonomy/);
    expect(text).toMatch(/EXTRACT\(YEAR FROM i\.updated_at\) = \$1/);
    expect(text).toMatch(/p\.client_id = ANY\(\$\d+::text\[\]\)/);
    expect(params).toEqual([2026, ['beta']]);
  });

  it('getReportVersion selects embargo_until, expires_at, and portal_visible', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getReportVersion(1, 10);

    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/embargo_until/);
    expect(sql).toMatch(/expires_at/);
    expect(sql).toMatch(/portal_visible/);
    expect(sql).toMatch(/published_by/);
    expect(sql).toMatch(/published_at/);
    expect(sql).not.toMatch(/ADD COLUMN/);
  });

  it('updateReportVersionPortalVisible stamps published_by and published_at when visible', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.updateReportVersionPortalVisible(1, 10, true, 'lead@ptt');

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/published_by/);
    expect(sql).toMatch(/published_at\s*=\s*now\(\)/);
    expect(params).toEqual(expect.arrayContaining([10, 1, true, 'lead@ptt']));
  });

  it('updateReportVersionPortalVisible does not clear audit columns when unpublishing', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 10,
          report_id: 1,
          version: 1,
          content_snapshot: {},
          generated_by: 'am@ptt',
          content_hash: 'abc',
          embargo_until: null,
          expires_at: null,
          portal_visible: false,
          published_by: 'lead@ptt',
          published_at: '2026-08-14T10:00:00.000Z',
          created_at: '2026-08-14',
        },
      ],
    });
    const repo = repoWithMock();

    const row = await repo.updateReportVersionPortalVisible(1, 10, false);

    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/portal_visible/);
    expect(sql).not.toMatch(/published_by\s*=/);
    expect(sql).not.toMatch(/published_at\s*=/);
    expect(row?.published_by).toBe('lead@ptt');
    expect(row?.published_at).toBeTruthy();
  });

  it('listReembedCandidates binds corpus stale filter and client scope', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listReembedCandidates({
      client_id: 'acme',
      target_dims: 256,
      target_model: 'text-embedding-3-small',
      limit: 25,
    });

    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/approved_client_facing/);
    expect(sql).toMatch(/published/);
    expect(sql).toMatch(/embed_dims IS DISTINCT FROM/);
    expect(sql).toMatch(/p\.client_id = \$3/);
    expect(params).toEqual([256, 'text-embedding-3-small', 'acme', 25]);
  });

  it('P37 getIsoGapFacts scopes SQL to project_id and never selects title', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.getIsoGapFacts(42);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toMatch(/WHERE p\.id = \$1/);
    expect(text).not.toMatch(/\btitle\b/);
    expect(text).toMatch(/crm_research_reviews/);
    expect(text).toMatch(/crm_research_report_versions/);
    expect(text).toMatch(/approved_client_facing/);
    expect(params).toEqual([42]);
  });

  it('P38 insertCjWhatIfRun scopes SQL to project_id and never selects title', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 1,
          project_id: 9,
          study_id: 5,
          scenario: { price: '99k' },
          n_match: 2,
          n_choices: 8,
          match_pct: 25,
          limitation_note: 'note',
          statistical_inference: false,
          created_by: 'an@ptt',
          created_at: '2026-08-16',
        },
      ],
    });
    const repo = repoWithMock();

    await repo.insertCjWhatIfRun(
      9,
      5,
      {
        n_match: 2,
        n_choices: 8,
        match_pct: 25,
        scenario: { price: '99k' },
        limitation_note: 'note',
        statistical_inference: false,
      },
      'an@ptt',
    );

    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/INSERT INTO crm_research_cj_whatif_runs/);
    expect(String(sql)).not.toMatch(/\btitle\b/);
    expect(params).toEqual(
      expect.arrayContaining([9, 5, expect.any(String), 2, 8, 25, 'note', false, 'an@ptt']),
    );
  });

  it('P38 listCjWhatIfRuns orders by id DESC with LIMIT 20', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();

    await repo.listCjWhatIfRuns(9);

    const [sql, params] = queryMock.mock.calls[0];
    const text = String(sql);
    expect(text).toMatch(/WHERE project_id = \$1/);
    expect(text).toMatch(/ORDER BY id DESC/);
    expect(text).toMatch(/LIMIT \$2/);
    expect(text).not.toMatch(/\btitle\b/);
    expect(params).toEqual([9, 20]);
  });
});
