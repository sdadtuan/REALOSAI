import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { InMemoryGtmSandboxStore } from './gtm-sandbox.store';
import { GtmSandboxAuthService } from './gtm-sandbox-auth.service';

function cfg(): AppConfigService {
  return {
    staffJwtSecret: 'test-sandbox-secret',
    staffJwtTtlSec: 3600,
    staffRefreshTtlSec: 86400,
  } as AppConfigService;
}

describe('GtmSandboxAuthService', () => {
  const store = new InMemoryGtmSandboxStore();
  const svc = new GtmSandboxAuthService(cfg(), store);

  beforeEach(() => {
    store.create({
      username: 'demo_abc',
      password: 'secret1234567890',
      tenant: 'sandbox_agency',
      email: 'vis@co.com',
      disabled: false,
      expires_at: '2026-12-31T00:00:00.000Z',
    });
  });

  it('issues sandbox_visitor tokens with caps', () => {
    const out = svc.login('demo_abc', 'secret1234567890');
    expect(out.user.position_code).toBe('sandbox_visitor');
    expect(out.user.locale).toBe('en');
    expect(out.user.tenant).toBe('sandbox_agency');
    expect(out.user.caps).toEqual(
      expect.arrayContaining([
        { section: 'sandbox.leads', action: 'view' },
        { section: 'sandbox.board', action: 'view' },
      ]),
    );
  });

  it('403 sandbox_expired when disabled', () => {
    store.disable('demo_abc');
    expect(() => svc.login('demo_abc', 'secret1234567890')).toThrow(ForbiddenException);
    try {
      svc.login('demo_abc', 'secret1234567890');
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'sandbox_expired' });
    }
  });

  it('401 on bad password', () => {
    expect(() => svc.login('demo_abc', 'wrong')).toThrow(UnauthorizedException);
  });
});
