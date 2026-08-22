import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class DealRoomEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.dealRoomEnabled) {
      throw new NotFoundException({
        error: 'deal_room_disabled',
        message: 'Deal Room chưa bật (PTT_DEAL_ROOM_ENABLED=0)',
      });
    }
    return true;
  }
}
