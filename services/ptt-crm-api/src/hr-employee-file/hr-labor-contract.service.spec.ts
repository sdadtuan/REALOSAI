import { ForbiddenException } from '@nestjs/common';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrLaborContractService } from './hr-labor-contract.service';

describe('HrLaborContractService', () => {
  const contractRepo = {
    tablesReady: jest.fn(),
    listForStaff: jest.fn(),
    getActiveSummary: jest.fn(),
    create: jest.fn(),
    patch: jest.fn(),
    createAppendix: jest.fn(),
    patchAppendix: jest.fn(),
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
    contractRepo.tablesReady.mockResolvedValue(true);
    staffRepo.assertStaffExists.mockResolvedValue({ id: 5 });
    contractRepo.listForStaff.mockResolvedValue([]);
    contractRepo.getActiveSummary.mockResolvedValue(null);
    staffAuth.me.mockResolvedValue({ caps: {} });
  });

  function svc(): HrLaborContractService {
    return new HrLaborContractService(contractRepo as never, staffRepo as never, staffAuth as never);
  }

  it('listContracts masks salary without crm_hr_pii.view', async () => {
    staffAuth.hasCap.mockReturnValue(false);
    contractRepo.listForStaff.mockResolvedValue([
      {
        id: 1,
        staff_id: 5,
        contract_no: 'HD-1',
        kind: 'fixed',
        signed_on: null,
        effective_on: '2026-01-01',
        expires_on: '2027-01-01',
        salary_gross: 20_000_000,
        currency: 'VND',
        work_place: '',
        job_title_legal: 'Dev',
        status: 'active',
        document_id: null,
        notes: '',
        appendices: [],
        created_at: '',
        updated_at: '',
      },
    ]);
    const out = await svc().listContracts(user, 5);
    expect(out.contracts[0].salary_gross).toBeNull();
    expect(out.contracts[0].salary_masked).toBe(true);
  });

  it('createContract rejects salary edit without crm_hr_pii.edit', async () => {
    staffAuth.hasCap.mockImplementation((_caps, section, action) => {
      if (section === 'crm_hr_contract' && action === 'edit') return true;
      if (section === 'crm_staff_roster' && action === 'edit') return true;
      return false;
    });
    await expect(
      svc().createContract(user, 5, { contract_no: 'HD-2', salary_gross: 10_000_000 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
