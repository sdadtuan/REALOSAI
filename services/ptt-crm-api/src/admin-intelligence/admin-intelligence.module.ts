import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PolicyModule } from '../policy/policy.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionSetsModule } from '../staff-permission-sets/staff-permission-sets.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { AdminIntelligenceController } from './admin-intelligence.controller';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import { AdminAiPolicyService } from './admin-ai-policy.service';
import { AdminPolicyCatalogService } from './admin-policy-catalog.service';
import { ChangeApprovalService } from './change-approval.service';
import { CompliancePackService } from './compliance-pack.service';
import { EnvironmentDiffService } from './environment-diff.service';
import { LegalEntityService } from './legal-entity.service';
import { PolicyImpactService } from './policy-impact.service';
import { ServiceAccountService } from './service-account.service';
import { DelegatedAdminGuard } from './guards/delegated-admin.guard';

@Module({
  imports: [
    forwardRef(() => StaffAuthModule),
    forwardRef(() => StaffPermissionsModule),
    StaffPermissionSetsModule,
    AdminAuditModule,
    PolicyModule,
  ],
  controllers: [AdminIntelligenceController],
  providers: [
    AdminIntelligenceRepository,
    PolicyImpactService,
    AdminPolicyCatalogService,
    EnvironmentDiffService,
    AdminAiPolicyService,
    ChangeApprovalService,
    CompliancePackService,
    ServiceAccountService,
    LegalEntityService,
    DelegatedAdminGuard,
  ],
  exports: [AdminAiPolicyService, ChangeApprovalService, AdminIntelligenceRepository],
})
export class AdminIntelligenceModule implements OnModuleInit {
  constructor(private readonly catalog: AdminPolicyCatalogService) {}

  onModuleInit(): void {
    void this.catalog.syncFromManifest('boot').catch(() => undefined);
  }
}
