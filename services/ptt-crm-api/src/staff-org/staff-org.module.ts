import { Module, forwardRef } from '@nestjs/common';
import { StaffClientScopeModule } from '../staff-client-scope/staff-client-scope.module';
import { StaffBreakGlassModule } from '../staff-break-glass/staff-break-glass.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffPermissionSetsModule } from '../staff-permission-sets/staff-permission-sets.module';
import { StaffOrgController } from './staff-org.controller';
import { StaffOrgService } from './staff-org.service';
import {
  StaffOrgConfigureGuard,
  StaffOrgDepartmentsConfigureGuard,
  StaffOrgDepartmentsViewGuard,
  StaffOrgEffectiveCapsGuard,
  StaffOrgRosterEditGuard,
  StaffOrgRosterViewGuard,
} from './guards/staff-org.guard';

@Module({
  imports: [
    forwardRef(() => StaffAuthModule),
    forwardRef(() => StaffPermissionsModule),
    StaffPermissionSetsModule,
    forwardRef(() => StaffBreakGlassModule),
    StaffClientScopeModule,
  ],
  controllers: [StaffOrgController],
  providers: [
    StaffOrgService,
    StaffOrgRosterViewGuard,
    StaffOrgConfigureGuard,
    StaffOrgDepartmentsViewGuard,
    StaffOrgDepartmentsConfigureGuard,
    StaffOrgEffectiveCapsGuard,
    StaffOrgRosterEditGuard,
  ],
  exports: [StaffOrgService],
})
export class StaffOrgModule {}
