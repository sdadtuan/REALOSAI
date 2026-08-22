import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AiToolApiKeyGuard } from './ai-tool-api-key.guard';

describe('AiToolApiKeyGuard', () => {
  const keys = { validateKey: jest.fn() };
  const staffAuth = {
    verifyAccessToken: jest.fn(),
    me: jest.fn(),
    hasCap: jest.fn(),
  };
  let guard: AiToolApiKeyGuard;

  function context(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AiToolApiKeyGuard(keys as never, staffAuth as never);
  });

  it('validates X-AI-Tool-Key and attaches the scoped key to the request', async () => {
    const apiKey = {
      id: 'key-1',
      name: 'bot',
      key_prefix: 'ptt_ai_abcde',
      client_id: null,
      allowed_tools: ['health_check'],
      rate_limit_per_min: 60,
      is_active: true,
      created_by: null,
      created_at: '2026-07-27T00:00:00.000Z',
      revoked_at: null,
    };
    keys.validateKey.mockResolvedValue(apiKey);
    const request = { headers: { 'x-ai-tool-key': 'ptt_ai_secret' } };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);

    expect(keys.validateKey).toHaveBeenCalledWith('ptt_ai_secret');
    expect(request).toEqual(expect.objectContaining({ aiToolApiKey: apiKey }));
  });

  it('enforces the configured per-key minute limit in memory', async () => {
    keys.validateKey.mockResolvedValue({
      id: 'key-1',
      allowed_tools: ['health_check'],
      rate_limit_per_min: 1,
    });
    const request = { headers: { 'x-ai-tool-key': 'ptt_ai_secret' } };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    await expect(guard.canActivate(context(request))).rejects.toMatchObject({
      status: 429,
    });
  });

  it('accepts a staff JWT only when it has ai_admin.view', async () => {
    const staffUser = { sub: 'staff-1', email: 'admin@example.com' };
    staffAuth.verifyAccessToken.mockReturnValue(staffUser);
    staffAuth.me.mockResolvedValue({ caps: [{ section: 'ai_admin', action: 'view' }] });
    staffAuth.hasCap.mockReturnValue(true);
    const request = { headers: { authorization: 'Bearer staff-token' } };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toEqual(
      expect.objectContaining({ staffUser, staffAuthVia: 'jwt' }),
    );
  });

  it('rejects staff JWTs without the required capability', async () => {
    staffAuth.verifyAccessToken.mockReturnValue({ sub: 'staff-1' });
    staffAuth.me.mockResolvedValue({ caps: [] });
    staffAuth.hasCap.mockReturnValue(false);

    await expect(
      guard.canActivate(context({ headers: { authorization: 'Bearer token' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing or invalid credentials', async () => {
    keys.validateKey.mockResolvedValue(null);

    await expect(
      guard.canActivate(context({ headers: { 'x-ai-tool-key': 'ptt_ai_bad' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(context({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
