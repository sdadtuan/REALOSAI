import { BadRequestException } from '@nestjs/common';
import { StaffOrgUsersRepository } from './staff-org-users.repository';

describe('StaffOrgUsersRepository validation', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn();
  const db = {
    query: mockQuery,
    connect: mockConnect,
  } as unknown as import('pg').Pool;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid email on createUser', async () => {
    const repo = new StaffOrgUsersRepository(db);
    await expect(
      repo.createUser({ email: 'not-an-email', position_id: 1 }, 'admin@test.vn'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid position on createUser', async () => {
    const repo = new StaffOrgUsersRepository(db);
    await expect(
      repo.createUser({ email: 'a@b.vn', position_id: 0 }, 'admin@test.vn'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
