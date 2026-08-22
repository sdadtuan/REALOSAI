import { ForbiddenException } from '@nestjs/common';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileService } from './hr-employee-file.service';

describe('HrEmployeeFileService', () => {
  const repo = {
    tablesReady: jest.fn(),
    assertStaffExists: jest.fn(),
    getIdentity: jest.fn(),
    listAddresses: jest.fn(),
    upsertIdentity: jest.fn(),
    putAddresses: jest.fn(),
    logPiiAudit: jest.fn(),
  };
  const walletRepo = {
    walletTablesReady: jest.fn(),
    listRequiredTypes: jest.fn(),
    listCards: jest.fn(),
  };
  const contractRepo = {
    tablesReady: jest.fn(),
    getActiveSummary: jest.fn(),
  };
  const insuranceRepo = {
    tablesReady: jest.fn(),
    getSummary: jest.fn(),
  };
  const p5Service = {
    lifecycleSummaryForProfile: jest.fn(),
  };
  const staffAuth = {
    me: jest.fn(),
    hasCap: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.tablesReady.mockResolvedValue(true);
    repo.assertStaffExists.mockResolvedValue({ id: 5, name: 'A' });
    repo.getIdentity.mockResolvedValue(null);
    repo.listAddresses.mockResolvedValue([]);
    walletRepo.walletTablesReady.mockResolvedValue(false);
    contractRepo.tablesReady.mockResolvedValue(false);
    insuranceRepo.tablesReady.mockResolvedValue(false);
    p5Service.lifecycleSummaryForProfile.mockResolvedValue(null);
    staffAuth.me.mockResolvedValue({ caps: {} });
  });

  function svc(): HrEmployeeFileService {
    return new HrEmployeeFileService(
      repo as never,
      walletRepo as never,
      contractRepo as never,
      insuranceRepo as never,
      p5Service as never,
      staffAuth as never,
    );
  }

  const user = {
    sub: 'u1',
    email: 'hr@test.vn',
    display_name: 'HR',
    position_id: 0,
    token_type: 'access',
    iat: 0,
    exp: 9999999999,
  } as StaffJwtPayload;

  it('getProfile masks identity without crm_hr_pii.view', async () => {
    staffAuth.hasCap.mockImplementation((_caps, section, action) => {
      if (section === 'crm_staff_roster' && action === 'edit') return true;
      return false;
    });
    repo.getIdentity.mockResolvedValue({
      staff_id: 5,
      legal_name: 'A',
      cccd: '001234567890',
      dob: null,
      gender: '',
      nationality: 'VN',
      cccd_issued_on: null,
      cccd_issued_by: '',
      tax_code: '0123456789',
      bank_name: 'VCB',
      bank_account: '123',
      bank_holder: 'A',
      timeclock_pin: '',
      created_at: '',
      updated_at: '',
    });
    const out = await svc().getProfile(user, 5);
    expect(out.identity.cccd).toBe('•••• 890');
    expect(out.can_view_pii).toBe(false);
  });

  it('patchIdentity rejects PII without crm_hr_pii.edit', async () => {
    staffAuth.hasCap.mockImplementation((_caps, section, action) => {
      if (section === 'crm_staff_roster' && action === 'edit') return true;
      return false;
    });
    await expect(svc().patchIdentity(user, 5, { cccd: '001234567890' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('patchIdentity audits PII patch', async () => {
    staffAuth.hasCap.mockReturnValue(true);
    repo.upsertIdentity.mockResolvedValue({
      staff_id: 5,
      legal_name: 'A',
      cccd: '001234567890',
      dob: null,
      gender: '',
      nationality: 'VN',
      cccd_issued_on: null,
      cccd_issued_by: '',
      tax_code: '',
      bank_name: '',
      bank_account: '',
      bank_holder: '',
      timeclock_pin: '',
      created_at: '',
      updated_at: '',
    });
    await svc().patchIdentity(user, 5, { cccd: '001234567890' });
    expect(repo.logPiiAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'patch_identity_pii', staffId: 5 }),
    );
  });
});
