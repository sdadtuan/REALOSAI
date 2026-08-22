import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isStaffTicketsEnabled } from './staff-ticket.flags';

@Injectable()
export class StaffTicketGuard implements CanActivate {
  canActivate(): boolean {
    if (!isStaffTicketsEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
