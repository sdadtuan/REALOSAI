import { Module, forwardRef } from '@nestjs/common';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { StaffPermissionSetsModule } from '../staff-permission-sets/staff-permission-sets.module';
import { StaffPermissionsController } from './staff-permissions.controller';
import { StaffPermissionsRepository } from './staff-permissions.repository';
import { StaffJobFunctionsRepository } from './staff-job-functions.repository';
import { StaffPermissionsService } from './staff-permissions.service';
import { StaffRbacAuditRepository } from './staff-rbac-audit.repository';
import { StaffPermissionsSimulatorService } from './staff-permissions-simulator.service';
import { StaffPermissionsAccessReviewService } from './staff-permissions-access-review.service';
import { StaffAccessReviewActionsRepository } from './staff-access-review-actions.repository';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from './guards/staff-permissions.guard';

@Module({
  imports: [
    forwardRef(() => StaffAuthModule),
    AdminAuditModule,
    StaffPermissionSetsModule,
    forwardRef(() => StaffOrgModule),
  ],
  controllers: [StaffPermissionsController],
  providers: [
    StaffPermissionsRepository,
    StaffJobFunctionsRepository,
    StaffPermissionsService,
    StaffRbacAuditRepository,
    StaffPermissionsSimulatorService,
    StaffPermissionsAccessReviewService,
    StaffAccessReviewActionsRepository,
    StaffPermissionsViewGuard,
    StaffPermissionsConfigureGuard,
  ],
  exports: [
    StaffPermissionsService,
    StaffPermissionsRepository,
    StaffJobFunctionsRepository,
    StaffRbacAuditRepository,
    StaffAccessReviewActionsRepository,
  ],
})
export class StaffPermissionsModule {}
