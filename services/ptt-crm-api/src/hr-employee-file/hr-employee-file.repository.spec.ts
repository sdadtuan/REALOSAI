import { BadRequestException } from '@nestjs/common';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';

describe('HrEmployeeFileRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): HrEmployeeFileRepository {
    const repo = new HrEmployeeFileRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock }; tablesReadyCache: boolean | null }).pool =
      { query: queryMock };
    (repo as unknown as { tablesReadyCache: boolean | null }).tablesReadyCache = true;
    return repo;
  }

  it('upsertIdentity rejects invalid CCCD', async () => {
    const repo = repoWithMock();
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(repo.upsertIdentity(7, { cccd: '123' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upsertIdentity checks duplicate CCCD', async () => {
    const repo = repoWithMock();
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ staff_id: 9 }] });
    await expect(repo.upsertIdentity(7, { cccd: '001234567890' })).rejects.toMatchObject({
      response: { error: 'cccd_duplicate' },
    });
    const dupSql = String(queryMock.mock.calls[1][0]);
    expect(dupSql).toMatch(/WHERE cccd = \$1 AND staff_id <> \$2/);
  });

  it('putAddresses copies permanent into temporary when same_as_permanent', async () => {
    const repo = repoWithMock();
    queryMock.mockResolvedValue({ rows: [] });
    await repo.putAddresses(5, [
      {
        kind: 'permanent',
        line1: '12 Nguyễn Huệ',
        province_code: '79',
        district_code: '760',
        ward_code: '26734',
      },
      { kind: 'temporary', same_as_permanent: true, line1: '' },
    ]);
    const insertSql = String(queryMock.mock.calls[1][0]);
    const params = queryMock.mock.calls[1][1] as unknown[];
    expect(insertSql).toMatch(/INSERT INTO hr_staff_addresses/);
    expect(params).toContain('12 Nguyễn Huệ');
    expect(params).toContain(true);
  });

  it('listAddresses orders permanent before temporary', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const repo = repoWithMock();
    await repo.listAddresses(3);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).toMatch(/ORDER BY CASE kind/);
    expect(sql).toMatch(/WHEN 'permanent' THEN 1/);
  });
});
