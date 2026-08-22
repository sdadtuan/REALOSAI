import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PortalClientUsersService } from './portal-client-users.service';

describe('PortalClientUsersService', () => {
  const repo = {
    tableReady: jest.fn(),
    clientExists: jest.fn(),
    listByClient: jest.fn(),
    emailTaken: jest.fn(),
    insertUser: jest.fn(),
    findById: jest.fn(),
    updateUser: jest.fn(),
    updatePassword: jest.fn(),
    getClientSummary: jest.fn(),
  };
  const tenantLock = {
    assertClientWritable: jest.fn(),
  };
  const credentialsNotify = {
    sendCredentialsEmail: jest.fn(),
  };
  const service = new PortalClientUsersService(repo as never, tenantLock as never, credentialsNotify as never);

  beforeEach(() => {
    jest.resetAllMocks();
    repo.tableReady.mockResolvedValue(true);
    repo.clientExists.mockResolvedValue(true);
    tenantLock.assertClientWritable.mockResolvedValue(undefined);
    repo.getClientSummary.mockResolvedValue({ name: 'Glow Beauty Spa', code: 'GLOW-SPA' });
    credentialsNotify.sendCredentialsEmail.mockResolvedValue({ ok: true });
  });

  it('list returns empty when table not ready', async () => {
    repo.tableReady.mockResolvedValue(false);
    const out = await service.list('client-1');
    expect(out.table_ready).toBe(false);
    expect(out.users).toEqual([]);
  });

  it('create generates temporary password when omitted', async () => {
    repo.emailTaken.mockResolvedValue(false);
    repo.insertUser.mockResolvedValue({
      id: 'u1',
      email: 'client@test.local',
      role: 'viewer',
      active: true,
      last_login_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const out = await service.create('client-1', { email: 'client@test.local' });
    expect(out.temporary_password).toBeTruthy();
    expect(out.user.email).toBe('client@test.local');
    expect(repo.insertUser).toHaveBeenCalled();
    expect(credentialsNotify.sendCredentialsEmail).toHaveBeenCalled();
  });

  it('create skips email when send_email is false', async () => {
    repo.emailTaken.mockResolvedValue(false);
    repo.insertUser.mockResolvedValue({
      id: 'u1',
      email: 'client@test.local',
      role: 'viewer',
      active: true,
      last_login_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    await service.create('client-1', { email: 'client@test.local', send_email: false });
    expect(credentialsNotify.sendCredentialsEmail).not.toHaveBeenCalled();
  });

  it('create rejects duplicate email', async () => {
    repo.emailTaken.mockResolvedValue(true);
    await expect(service.create('client-1', { email: 'dup@test.local', password: 'longpass12' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('create rejects short password', async () => {
    await expect(service.create('client-1', { email: 'a@b.co', password: 'short' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create fails when table not ready', async () => {
    repo.tableReady.mockResolvedValue(false);
    await expect(service.create('client-1', { email: 'a@b.co', password: 'longpass12' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('update 404 when user missing', async () => {
    repo.updateUser.mockResolvedValue(null);
    await expect(service.update('client-1', 'missing', { active: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resetPassword returns temporary password', async () => {
    repo.findById.mockResolvedValue({
      id: 'u1',
      email: 'client@test.local',
      role: 'approver',
      active: true,
      last_login_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    repo.updatePassword.mockResolvedValue(true);
    const out = await service.resetPassword('client-1', 'u1', {});
    expect(out.ok).toBe(true);
    expect(out.temporary_password).toBeTruthy();
  });

  it('resetPassword sends email when requested', async () => {
    repo.findById.mockResolvedValue({
      id: 'u1',
      email: 'client@test.local',
      role: 'approver',
      active: true,
      last_login_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    repo.updatePassword.mockResolvedValue(true);
    const out = await service.resetPassword('client-1', 'u1', { send_email: true });
    expect(out.ok).toBe(true);
    expect(credentialsNotify.sendCredentialsEmail).toHaveBeenCalled();
  });
});
