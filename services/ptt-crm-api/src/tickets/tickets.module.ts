import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from '../cases/guards/staff-cases.guard';
import { TicketsController } from './tickets.controller';
import { TicketsSqliteRepository } from './tickets-sqlite.repository';
import { TicketsService } from './tickets.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketsSqliteRepository, StaffCasesViewGuard, StaffCasesWriteGuard],
  exports: [TicketsService, TicketsSqliteRepository],
})
export class TicketsModule {}
