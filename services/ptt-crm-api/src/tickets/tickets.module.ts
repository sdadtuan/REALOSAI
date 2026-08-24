import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from '../cases/guards/staff-cases.guard';
import { TicketsController } from './tickets.controller';
import { TicketsPgRepository } from './tickets-pg.repository';
import { TicketsService } from './tickets.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsPgRepository,
    StaffCasesViewGuard,
    StaffCasesWriteGuard,
  ],
  exports: [TicketsService, TicketsPgRepository],
})
export class TicketsModule {}
