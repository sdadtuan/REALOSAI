import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from '../cases/guards/staff-cases.guard';
import { TicketsController } from './tickets.controller';
import { TicketsPgRepository } from './tickets-pg.repository';
import { TicketsSqliteRepository } from './tickets-sqlite.repository';
import { TicketsService } from './tickets.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsSqliteRepository,
    TicketsPgRepository,
    StaffCasesViewGuard,
    StaffCasesWriteGuard,
  ],
  exports: [TicketsService, TicketsSqliteRepository, TicketsPgRepository],
})
export class TicketsModule {}
