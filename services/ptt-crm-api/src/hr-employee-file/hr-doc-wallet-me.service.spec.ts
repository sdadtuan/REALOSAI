import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrDocWalletMeService } from './hr-doc-wallet-me.service';

describe('HrDocWalletMeService', () => {
  const walletRepo = {
    walletTablesReady: jest.fn(),
    listCards: jest.fn(),
    listRequiredTypes: jest.fn(),
    listDocTypes: jest.fn(),
    createCard: jest.fn(),
    getCard: jest.fn(),
    countFiles: jest.fn(),
    addFile: jest.fn(),
    getFile: jest.fn(),
  };
  const staffRepo = { assertStaffExists: jest.fn() };
  const storage = { save: jest.fn(), read: jest.fn() };
  const staffAuth = { resolveCrmStaffUserId: jest.fn() };

  const user = {
    sub: 'u1',
    email: 'nv@test.vn',
    display_name: 'NV',
    position_id: 0,
    token_type: 'access',
    iat: 0,
    exp: 9999999999,
  } as StaffJwtPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    walletRepo.walletTablesReady.mockResolvedValue(true);
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(5);
    staffRepo.assertStaffExists.mockResolvedValue({ id: 5 });
    walletRepo.listRequiredTypes.mockResolvedValue([]);
    walletRepo.listCards.mockResolvedValue([]);
    walletRepo.listDocTypes.mockResolvedValue([
      { type_code: 'cert_it', category: 'cert', label: 'IT' },
      { type_code: 'cccd_front', category: 'identity', label: 'CCCD' },
    ]);
  });

  function svc(): HrDocWalletMeService {
    return new HrDocWalletMeService(walletRepo as never, staffRepo as never, storage as never, staffAuth as never);
  }

  it('submitCard rejects identity types for self-submit', async () => {
    await expect(svc().submitCard(user, { type_code: 'cccd_front', title: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('submitCard creates pending card for allowed type', async () => {
    walletRepo.createCard.mockResolvedValue({ id: 1, status: 'pending_review' });
    const out = await svc().submitCard(user, { type_code: 'cert_it', title: 'AWS' });
    expect(out.card.status).toBe('pending_review');
    expect(walletRepo.createCard).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ type_code: 'cert_it' }),
      expect.objectContaining({ forcePending: true }),
    );
  });

  it('listMyWallet requires linked staff profile', async () => {
    staffAuth.resolveCrmStaffUserId.mockResolvedValue(null);
    await expect(svc().listMyWallet(user)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
