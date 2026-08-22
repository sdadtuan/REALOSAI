import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffMentionService } from './staff-mention.service';
import { StaffNotificationsController } from './staff-notifications.controller';
import { StaffNotificationsRepository } from './staff-notifications.repository';
import { StaffNotificationsService } from './staff-notifications.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [StaffNotificationsController],
  providers: [
    StaffNotificationsRepository,
    StaffNotificationsService,
    StaffMentionService,
  ],
  exports: [StaffMentionService, StaffNotificationsRepository],
})
export class StaffNotificationsModule {}
