import { HealthController } from './health.controller';
import type { AppConfigService } from '../config/app-config.service';
import type { PolicyService } from '../policy/policy.service';

describe('HealthController sqliteDisabled', () => {
  it('ok true when sqlite disabled and file missing', () => {
    const config = {
      leadsReadSource: 'pg',
      leadsWriteEnabled: true,
      leadsCreateIdMode: 'prod',
      portalStubUsers: [],
      staffAuthMode: 'nest',
      staffSsoConfigured: () => false,
      staffPolicyOpaEnabled: false,
      sqliteAvailable: () => false,
      sqliteDisabled: true,
      databaseUrl: 'postgresql://x',
    } as unknown as AppConfigService;
    const policy = { loadManifestVersion: () => null } as unknown as PolicyService;
    const body = new HealthController(config, policy).getHealth();
    expect(body.ok).toBe(true);
    expect(body.sqlite).toBe(false);
    expect(body.sqlite_disabled).toBe(true);
    expect(body.postgres).toBe(true);
  });
});
