import { BadRequestException } from '@nestjs/common';
import { HrInsuranceRepository } from './hr-insurance.repository';

describe('HrInsuranceRepository', () => {
  const queryMock = jest.fn();
  const config = { databaseUrl: 'postgresql://test' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock.mockReset();
  });

  function repoWithMock(): HrInsuranceRepository {
    const repo = new HrInsuranceRepository(config);
    (repo as unknown as { pool: { query: typeof queryMock }; readyCache: boolean | null }).pool = {
      query: queryMock,
    };
    (repo as unknown as { readyCache: boolean | null }).readyCache = true;
    return repo;
  }

  it('createPeriod rejects missing year/month', async () => {
    const repo = repoWithMock();
    await expect(repo.createPeriod(5, { kind: 'bhxh' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
