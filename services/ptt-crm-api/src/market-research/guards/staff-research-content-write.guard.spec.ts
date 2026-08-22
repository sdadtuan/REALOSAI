import { ForbiddenException } from '@nestjs/common';
import { StaffResearchContentWriteGuard } from './staff-market-research.guard';

describe('StaffResearchContentWriteGuard', () => {
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
    const guard = new StaffResearchContentWriteGuard(staffAuth as never);
    await expect(guard.canActivate(ctx({ staffAuthVia: 'internal' }))).resolves.toBe(true);
    expect(staffAuth.me).not.toHaveBeenCalled();
  });

  it('missing crm_content.write is 403 missing_cap', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_research', action: 'edit' }],
    });
    const guard = new StaffResearchContentWriteGuard(staffAuth as never);
    try {
      await guard.canActivate(
        ctx({
          staffUser: { sub: 'staff-1', position_id: 1 },
        }),
      );
      throw new Error('expected missing_cap');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({
        error: 'missing_cap',
        section: 'crm_content',
        action: 'write',
      });
    }
  });

  it('allows crm_content.write', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_content', action: 'write' }],
    });
    const guard = new StaffResearchContentWriteGuard(staffAuth as never);
    await expect(
      guard.canActivate(
        ctx({
          staffUser: { sub: 'staff-1', position_id: 1 },
        }),
      ),
    ).resolves.toBe(true);
  });
});
