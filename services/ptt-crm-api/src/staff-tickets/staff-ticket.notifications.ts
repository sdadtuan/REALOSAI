import { Injectable, Logger, Optional } from '@nestjs/common';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { StaffTicketRepository } from './staff-ticket.repository';
import { isStaffTicketsNotifyEnabled } from './staff-ticket.flags';

@Injectable()
export class StaffTicketNotifications {
  private readonly logger = new Logger(StaffTicketNotifications.name);

  constructor(
    @Optional() private readonly notifications?: StaffNotificationsRepository | null,
    @Optional() private readonly repo?: StaffTicketRepository | null,
  ) {}

  async notifySlaBreach(input: {
    staffIds: number[];
    ticketId: string;
    ticketNumber: string;
    title: string;
  }): Promise<void> {
    if (!isStaffTicketsNotifyEnabled() || !this.notifications || !this.repo) return;
    const href = `/crm/work?ticket=${input.ticketId}`;
    const body = `${input.ticketNumber}: ${input.title}`;
    for (const staffId of input.staffIds) {
      try {
        const userId = await this.repo.getStaffUserUuid(staffId);
        if (!userId) continue;
        await this.notifications.create({
          user_id: userId,
          kind: 'ticket_sla',
          title: 'Ticket quá SLA',
          body,
          link_href: href,
        });
      } catch (err) {
        this.logger.warn(`notifySlaBreach staff=${staffId}: ${String(err)}`);
      }
    }
  }
}
