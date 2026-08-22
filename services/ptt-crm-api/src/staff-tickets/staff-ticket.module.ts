import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffTicketController } from './staff-ticket.controller';
import { StaffTicketGuard } from './staff-ticket.guard';
import { StaffTicketRepository } from './staff-ticket.repository';
import { StaffTicketService } from './staff-ticket.service';
import { StaffTicketSlaJob } from './staff-ticket.sla.job';

@Module({
  imports: [StaffAuthModule],
  controllers: [StaffTicketController],
  providers: [StaffTicketRepository, StaffTicketService, StaffTicketGuard, StaffTicketSlaJob],
  exports: [StaffTicketService],
})
export class StaffTicketModule {}
