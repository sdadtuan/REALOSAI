import { GtmRepository } from './gtm.repository';

describe('GtmRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): GtmRepository {
    const repo = new GtmRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock } }).pool = { query: queryMock };
    return repo;
  }

  it('findLeadIdByEmailSince queries recent lead_id by email', async () => {
    queryMock.mockResolvedValue({ rows: [{ lead_id: '88' }] });
    const repo = repoWithMock();
    const since = new Date('2026-08-08T00:00:00.000Z');

    const leadId = await repo.findLeadIdByEmailSince('an@agency.vn', since);

    expect(leadId).toBe('88');
    const sql = String(queryMock.mock.calls[0][0]);
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/lower\(email\) = lower\(\$1\)/);
    expect(sql).toMatch(/created_at >= \$2/);
    expect(params).toEqual(['an@agency.vn', since]);
  });

  it('insert writes demo request row', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          created_at: new Date('2026-08-15T10:00:00.000Z'),
          updated_at: new Date('2026-08-15T10:00:00.000Z'),
          locale: 'vi',
          full_name: 'Nguyen An',
          email: 'an@agency.vn',
          phone: '0901234567',
          company: 'An Agency',
          industry: 'agency',
          sku_interest: 'agy',
          company_size: null,
          message: null,
          landing_path: '/vi/giai-phap/agency',
          utm_source: 'google',
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null,
          status: 'new',
          status_note: null,
          owner_user_id: 'u2',
          lead_id: '42',
          sandbox_expires_at: null,
          sandbox_user_id: null,
          ip_hash: 'abc',
        },
      ],
    });
    const repo = repoWithMock();

    const row = await repo.insert({
      locale: 'vi',
      full_name: 'Nguyen An',
      email: 'an@agency.vn',
      phone: '0901234567',
      company: 'An Agency',
      industry: 'agency',
      sku_interest: 'agy',
      consent_privacy: true,
      landing_path: '/vi/giai-phap/agency',
      utm_source: 'google',
      ip_hash: 'abc',
      lead_id: '42',
      owner_user_id: 'u2',
    });

    expect(row.id).toBe('uuid-1');
    expect(row.lead_id).toBe('42');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/INSERT INTO gtm_demo_request/);
  });

  it('list applies filters and pagination', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = repoWithMock();

    await repo.list({ status: 'new', limit: 25, offset: 5 });

    const countSql = String(queryMock.mock.calls[0][0]);
    const listSql = String(queryMock.mock.calls[1][0]);
    expect(countSql).toMatch(/status = \$1/);
    expect(listSql).toMatch(/LIMIT \$2 OFFSET \$3/);
  });
});
