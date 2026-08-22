import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffHrLeaveApproveGuard,
  StaffHrLeaveRequestGuard,
} from './guards/staff-hr-leave.guard';
import { HrLeaveController } from './hr-leave.controller';
import { HrLeaveRepository } from './hr-leave.repository';
import { HrLeaveService } from './hr-leave.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [HrLeaveController],
  providers: [
    HrLeaveRepository,
    HrLeaveService,
    StaffHrLeaveRequestGuard,
    StaffHrLeaveApproveGuard,
  ],
  exports: [HrLeaveRepository],
})
export class HrLeaveModule {}
