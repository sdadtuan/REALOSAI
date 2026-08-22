import { ForbiddenException } from '@nestjs/common';
import { StaffMarketResearchConfigureGuard } from './staff-market-research.guard';

describe('StaffMarketResearchConfigureGuard', () => {
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

  it('M4-1c: POST taxonomy without configure → 403 missing_cap', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_research', action: 'edit' }],
    });
    const guard = new StaffMarketResearchConfigureGuard(staffAuth as never);
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
        section: 'crm_research',
        action: 'configure',
      });
    }
  });

  it('allows crm_research.configure', async () => {
    staffAuth.me.mockResolvedValue({
      caps: [{ section: 'crm_research', action: 'configure' }],
    });
    const guard = new StaffMarketResearchConfigureGuard(staffAuth as never);
    await expect(
      guard.canActivate(
        ctx({
          staffUser: { sub: 'staff-1', position_id: 1 },
        }),
      ),
    ).resolves.toBe(true);
  });
});
