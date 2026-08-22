import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffPermissionsModule } from '../staff-permissions/staff-permissions.module';
import { StaffBreakGlassController } from './staff-break-glass.controller';
import { StaffBreakGlassRepository } from './staff-break-glass.repository';
import { StaffBreakGlassService } from './staff-break-glass.service';
import { StaffBreakGlassApproveGuard } from './guards/staff-break-glass.guard';

@Module({
  imports: [forwardRef(() => StaffAuthModule), forwardRef(() => StaffPermissionsModule)],
  controllers: [StaffBreakGlassController],
  providers: [
    StaffBreakGlassRepository,
    StaffBreakGlassService,
    StaffBreakGlassApproveGuard,
  ],
  exports: [StaffBreakGlassRepository, StaffBreakGlassService],
})
export class StaffBreakGlassModule {}
