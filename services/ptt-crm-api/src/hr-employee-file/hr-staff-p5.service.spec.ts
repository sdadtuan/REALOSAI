import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrStaffP5Service } from './hr-staff-p5.service';

describe('HrStaffP5Service', () => {
  const p5Repo = {
    tablesReady: jest.fn(),
    listDependents: jest.fn(),
    createDependent: jest.fn(),
    patchDependent: jest.fn(),
    deleteDependent: jest.fn(),
    getLifecycle: jest.fn(),
    patchLifecycle: jest.fn(),
    checkOfficialGate: jest.fn(),
    hubExpirySummary: jest.fn(),
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
    p5Repo.tablesReady.mockResolvedValue(true);
    staffRepo.assertStaffExists.mockResolvedValue({ id: 5 });
    staffAuth.me.mockResolvedValue({ caps: {} });
  });

  function svc(): HrStaffP5Service {
    return new HrStaffP5Service(p5Repo as never, staffRepo as never, staffAuth as never);
  }

  it('listDependents masks cccd without crm_hr_pii.view', async () => {
    staffAuth.hasCap.mockReturnValue(false);
    p5Repo.listDependents.mockResolvedValue([
      {
        id: 1,
        staff_id: 5,
        name: 'Con A',
        relation: 'con',
        dob: '2015-01-01',
        tax_dependent: true,
        cccd: '001234567890',
        notes: '',
        created_at: '',
        updated_at: '',
      },
    ]);
    const out = await svc().listDependents(user, 5);
    expect(out.dependents[0].cccd).toMatch(/••••/);
    expect(out.dependents[0].cccd_masked).toBe(true);
  });

  it('patchLifecycle blocks official when gate fails', async () => {
    staffAuth.hasCap.mockImplementation((_caps, section, action) => {
      if (section === 'crm_staff_roster' && action === 'edit') return true;
      return false;
    });
    p5Repo.checkOfficialGate.mockResolvedValue(['active_contract', 'cccd']);
    await expect(svc().patchLifecycle(user, 5, { stage: 'official' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('createDependent rejects without crm_hr_pii.edit', async () => {
    staffAuth.hasCap.mockReturnValue(false);
    await expect(svc().createDependent(user, 5, { name: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
