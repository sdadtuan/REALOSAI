import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { StaffAiCopilotGuard } from './staff-ai-copilot.guard';

describe('StaffAiCopilotGuard', () => {
  const aiConfig = {
    copilotEnabled: true,
    copilotRolloutMode: 'pilot' as const,
    canUseCopilot: jest.fn(),
  };
  const staffAuth = {
    me: jest.fn(),
  };

  let guard: StaffAiCopilotGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = true;
    aiConfig.copilotRolloutMode = 'pilot';
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'crm_leads', action: 'view' }] });
    guard = new StaffAiCopilotGuard(aiConfig as never, staffAuth as never);
  });

  function ctx(req: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  it('throws when copilot disabled', async () => {
    (aiConfig as { copilotEnabled: boolean }).copilotEnabled = false;
    await expect(guard.canActivate(ctx({}))).rejects.toThrow(ServiceUnavailableException);
  });

  it('allows internal key bypass', async () => {
    await expect(guard.canActivate(ctx({ staffAuthVia: 'internal' }))).resolves.toBe(true);
  });

  it('requires staff jwt when not internal', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('blocks staff outside rollout', async () => {
    aiConfig.canUseCopilot.mockReturnValue(false);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-x' } })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows staff in rollout', async () => {
    aiConfig.canUseCopilot.mockReturnValue(true);
    await expect(
      guard.canActivate(ctx({ staffUser: { sub: 'staff-1' } })),
    ).resolves.toBe(true);
  });
});
