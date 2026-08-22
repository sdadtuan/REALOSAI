import { BadRequestException } from '@nestjs/common';
import { HrLaborContractRepository } from './hr-labor-contract.repository';

describe('HrLaborContractRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): HrLaborContractRepository {
    const repo = new HrLaborContractRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock }; readyCache: boolean | null }).pool = {
      query: queryMock,
    };
    (repo as unknown as { readyCache: boolean | null }).readyCache = true;
    return repo;
  }

  it('create rejects indefinite contract with expires_on', async () => {
    const repo = repoWithMock();
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(
      repo.create(5, { contract_no: 'HD-X', kind: 'indefinite', expires_on: '2027-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create supersedes other active contracts when status active', async () => {
    const repo = repoWithMock();
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            staff_id: 5,
            contract_no: 'HD-9',
            kind: 'fixed',
            signed_on: null,
            effective_on: '2026-01-01',
            expires_on: '2027-01-01',
            salary_gross: null,
            currency: 'VND',
            work_place: '',
            job_title_legal: '',
            status: 'active',
            document_id: null,
            document_title: null,
            notes: '',
            created_at: '',
            updated_at: '',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    await repo.create(5, { contract_no: 'HD-9', status: 'active' });
    const supersedeSql = String(queryMock.mock.calls.find((c) => String(c[0]).includes('superseded'))?.[0] ?? '');
    expect(supersedeSql).toMatch(/status = 'superseded'/);
  });
});
