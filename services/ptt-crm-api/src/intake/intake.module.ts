import { Module, forwardRef } from '@nestjs/common';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffIntakeViewGuard, StaffIntakeWriteGuard } from './guards/staff-intake.guard';
import { IntakeB2bVisibilityService } from './intake-b2b-visibility.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { IntakePgRepository } from './intake-pg.repository';
import { IntakeSqliteRepository } from './intake-sqlite.repository';

@Module({
  imports: [StaffAuthModule, B2bProjectsModule, forwardRef(() => LeadsModule), LeadMeetingPrepAsyncModule],
  controllers: [IntakeController],
  providers: [
    IntakeService,
    IntakeB2bVisibilityService,
    IntakeSqliteRepository,
    IntakePgRepository,
    StaffIntakeViewGuard,
    StaffIntakeWriteGuard,
  ],
  exports: [IntakeService, IntakeSqliteRepository, IntakePgRepository],
})
export class IntakeModule {}
