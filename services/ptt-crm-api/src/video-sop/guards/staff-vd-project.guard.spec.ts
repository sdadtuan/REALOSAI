import { ForbiddenException } from '@nestjs/common';
import { StaffVdProjectCreateGuard } from './staff-vd-project.guard';

describe('StaffVdProjectCreateGuard', () => {
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
    const guard = new StaffVdProjectCreateGuard(staffAuth as never);
    await expect(guard.canActivate(ctx({ staffAuthVia: 'internal' }))).resolves.toBe(true);
    expect(staffAuth.me).not.toHaveBeenCalled();
  });

  it('allows crm_vd.project create', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_vd.project', action: 'create' }],
    });
    const guard = new StaffVdProjectCreateGuard(staffAuth as never);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } })),
    ).resolves.toBe(true);
  });

  it('allows crm_content write fallback', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_content', action: 'write' }],
    });
    const guard = new StaffVdProjectCreateGuard(staffAuth as never);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } })),
    ).resolves.toBe(true);
  });

  it('missing both caps is 403 missing_cap', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_board', action: 'edit' }],
    });
    const guard = new StaffVdProjectCreateGuard(staffAuth as never);
    try {
      await guard.canActivate(ctx({ staffUser: { sub: 'staff-1', position_id: 1 } }));
      throw new Error('expected missing_cap');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({
        error: 'missing_cap',
        section: 'crm_vd.project',
        action: 'create',
      });
    }
  });
});
