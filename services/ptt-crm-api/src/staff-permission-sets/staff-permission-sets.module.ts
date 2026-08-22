import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionSetsController } from './staff-permission-sets.controller';
import { StaffPermissionSetsRepository } from './staff-permission-sets.repository';
import { StaffPermissionSetsService } from './staff-permission-sets.service';
import {
  StaffPermissionSetsConfigureGuard,
  StaffPermissionSetsRosterEditGuard,
  StaffPermissionSetsRosterViewGuard,
} from './guards/staff-permission-sets.guard';

@Module({
  imports: [forwardRef(() => StaffAuthModule)],
  controllers: [StaffPermissionSetsController],
  providers: [
    StaffPermissionSetsRepository,
    StaffPermissionSetsService,
    StaffPermissionSetsConfigureGuard,
    StaffPermissionSetsRosterViewGuard,
    StaffPermissionSetsRosterEditGuard,
  ],
  exports: [StaffPermissionSetsRepository, StaffPermissionSetsService],
})
export class StaffPermissionSetsModule {}
