import { ForbiddenException } from '@nestjs/common';
import { StaffVdAdminCreateGuard, StaffVdAdminViewGuard } from './staff-vd-admin.guard';

describe('StaffVdAdmin guards', () => {
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

  it('view guard allows crm_vd.admin view only', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_vd.admin', action: 'view' }],
    });
    const guard = new StaffVdAdminViewGuard(staffAuth as never);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } })),
    ).resolves.toBe(true);
  });

  it('create guard forbids crm_vd.admin view only', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_vd.admin', action: 'view' }],
    });
    const guard = new StaffVdAdminCreateGuard(staffAuth as never);
    try {
      await guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } }));
      throw new Error('expected missing_cap');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({
        error: 'missing_cap',
        section: 'crm_vd.admin',
        action: 'create',
      });
    }
  });

  it('create guard allows crm_vd.admin create', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_vd.admin', action: 'create' }],
    });
    const guard = new StaffVdAdminCreateGuard(staffAuth as never);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } })),
    ).resolves.toBe(true);
  });

  it('create guard allows ai_admin view fallback', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'ai_admin', action: 'view' }],
    });
    const guard = new StaffVdAdminCreateGuard(staffAuth as never);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } })),
    ).resolves.toBe(true);
  });
});
