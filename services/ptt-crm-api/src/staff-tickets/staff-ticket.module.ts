import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { StaffTicketController } from './staff-ticket.controller';
import { StaffTicketGuard } from './staff-ticket.guard';
import { StaffTicketNotifications } from './staff-ticket.notifications';
import { StaffTicketRepository } from './staff-ticket.repository';
import { StaffTicketService } from './staff-ticket.service';
import { StaffTicketSlaJob } from './staff-ticket.sla.job';

@Module({
  imports: [StaffAuthModule, StaffNotificationsModule],
  controllers: [StaffTicketController],
  providers: [
    StaffTicketRepository,
    StaffTicketService,
    StaffTicketNotifications,
    StaffTicketGuard,
    StaffTicketSlaJob,
  ],
  exports: [StaffTicketService],
})
export class StaffTicketModule {}
