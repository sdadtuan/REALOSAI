import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PolicyService } from '../policy/policy.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly policy: PolicyService,
  ) {}

  @Get()
  getHealth(): {
    ok: boolean;
    service: string;
    leads_read_source: string;
    leads_write_enabled: boolean;
    leads_create_id_mode: string;
    portal_auth_stub_users: number;
    staff_auth_mode: string;
    staff_sso_configured: boolean;
    staff_policy_opa: boolean;
    policy_bundle_version: string | null;
    sqlite: boolean;
    postgres: boolean;
  } {
    return {
      ok: true,
      service: 'ptt-crm-api',
      leads_read_source: this.config.leadsReadSource,
      leads_write_enabled: this.config.leadsWriteEnabled,
      leads_create_id_mode: this.config.leadsCreateIdMode,
      portal_auth_stub_users: this.config.portalStubUsers.length,
      staff_auth_mode: this.config.staffAuthMode,
      staff_sso_configured: this.config.staffSsoConfigured(),
      staff_policy_opa: this.config.staffPolicyOpaEnabled,
      policy_bundle_version: this.config.staffPolicyOpaEnabled
        ? this.policy.loadManifestVersion()
        : null,
      sqlite: this.config.sqliteAvailable(),
      postgres: Boolean(this.config.databaseUrl),
    };
  }
}
