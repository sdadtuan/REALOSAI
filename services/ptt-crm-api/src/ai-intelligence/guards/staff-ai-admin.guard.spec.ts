import { ForbiddenException } from '@nestjs/common';
import { StaffAiAdminGuard } from './staff-ai-admin.guard';

describe('StaffAiAdminGuard', () => {
  const staffAuth = {
    me: jest.fn(),
    hasCap: jest.fn((caps: Array<{ section: string; action: string }>, section: string, action: string) =>
      caps.some((c) => c.section === section && c.action === action),
    ),
  };

  function ctx(req: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows internal key', async () => {
    const guard = new StaffAiAdminGuard(staffAuth as never);
    await expect(guard.canActivate(ctx({ staffAuthVia: 'internal' }))).resolves.toBe(true);
    expect(staffAuth.me).not.toHaveBeenCalled();
  });

  it('allows ai_admin.view cap', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'ai_admin', action: 'view' }],
    });
    const guard = new StaffAiAdminGuard(staffAuth as never);
    await expect(
      guard.canActivate(
        ctx({
          staffUser: { sub: 'staff-1', position_id: 1 },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('denies without cap', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_leads', action: 'view' }],
    });
    const guard = new StaffAiAdminGuard(staffAuth as never);
    await expect(
      guard.canActivate(
        ctx({
          staffUser: { sub: 'staff-1', position_id: 1 },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
