import { ForbiddenException } from '@nestjs/common';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrInsuranceService } from './hr-insurance.service';

describe('HrInsuranceService', () => {
  const insuranceRepo = {
    tablesReady: jest.fn(),
    getForStaff: jest.fn(),
    listPeriods: jest.fn(),
    getSummary: jest.fn(),
    upsert: jest.fn(),
    createPeriod: jest.fn(),
    patchPeriod: jest.fn(),
  };
  const staffRepo = { assertStaffExists: jest.fn() };
  const staffAuth = { me: jest.fn(), hasCap: jest.fn() };

  const user = {
    sub: 'u1',
    email: 'hr@test.vn',
    display_name: 'HR',
    position_id: 0,
    token_type: 'access',
    iat: 0,
    exp: 9999999999,
  } as StaffJwtPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    insuranceRepo.tablesReady.mockResolvedValue(true);
    staffRepo.assertStaffExists.mockResolvedValue({ id: 5 });
    insuranceRepo.getForStaff.mockResolvedValue({
      staff_id: 5,
      bhxh_book_no: 'BH1234567890',
      bhxh_joined_on: null,
      bhxh_status: 'active',
      bhxh_document_id: null,
      bhyt_card_no: 'DN1234567890123',
      bhyt_valid_from: null,
      bhyt_valid_to: null,
      bhyt_clinic_name: '',
      bhyt_document_id: null,
      bhtn_joined_on: null,
      bhtn_status: 'active',
      bhtn_document_id: null,
      notes: '',
      created_at: '',
      updated_at: '',
    });
    insuranceRepo.listPeriods.mockResolvedValue([]);
    insuranceRepo.getSummary.mockResolvedValue(null);
    staffAuth.me.mockResolvedValue({ caps: {} });
  });

  function svc(): HrInsuranceService {
    return new HrInsuranceService(insuranceRepo as never, staffRepo as never, staffAuth as never);
  }

  it('getInsurance masks book and card without crm_hr_pii.view', async () => {
    staffAuth.hasCap.mockReturnValue(false);
    const out = await svc().getInsurance(user, 5);
    expect(out.register.bhxh_book_no).toBe('•••• 890');
    expect(out.register.bhyt_card_no).toContain('••••');
  });

  it('putInsurance rejects PII edit without crm_hr_pii.edit', async () => {
    staffAuth.hasCap.mockImplementation((_caps, section, action) => {
      if (section === 'crm_hr_insurance' && action === 'edit') return true;
      if (section === 'crm_staff_roster' && action === 'edit') return true;
      return false;
    });
    await expect(svc().putInsurance(user, 5, { bhxh_book_no: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
