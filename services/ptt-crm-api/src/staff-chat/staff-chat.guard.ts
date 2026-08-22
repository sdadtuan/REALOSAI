import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isStaffChatEnabled } from './staff-chat.flags';

@Injectable()
export class StaffChatGuard implements CanActivate {
  canActivate(): boolean {
    if (!isStaffChatEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
