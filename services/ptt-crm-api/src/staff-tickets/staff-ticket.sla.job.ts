import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isStaffTicketsEnabled } from './staff-ticket.flags';
import { StaffTicketService } from './staff-ticket.service';

@Injectable()
export class StaffTicketSlaJob {
  constructor(private readonly tickets: StaffTicketService) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (!isStaffTicketsEnabled()) return;
    await this.tickets.markSlaBreaches(new Date());
  }
}
