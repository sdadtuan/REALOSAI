import { Module, forwardRef } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import {
  AdminGovernanceController,
  AdminIntegrationsController,
} from './admin-governance.controller';
import { AccessReviewCampaignRepository } from './access-review-campaign.repository';
import { AccessReviewCampaignService } from './access-review-campaign.service';
import { AdminIntegrationsService } from './admin-integrations.service';
import { GuestAccountExpiryService } from './guest-account-expiry.service';
import { StaleAccountService } from './stale-account.service';
import { AccessReviewCertifyGuard } from './guards/access-review-certify.guard';

@Module({
  imports: [
    forwardRef(() => StaffAuthModule),
    forwardRef(() => StaffPermissionsModule),
    forwardRef(() => StaffOrgModule),
    forwardRef(() => AdminAuditModule),
  ],
  controllers: [AdminGovernanceController, AdminIntegrationsController],
  providers: [
    AccessReviewCampaignRepository,
    AccessReviewCampaignService,
    StaleAccountService,
    GuestAccountExpiryService,
    AdminIntegrationsService,
    AccessReviewCertifyGuard,
  ],
  exports: [AccessReviewCampaignService, GuestAccountExpiryService],
})
export class AdminGovernanceModule {}
