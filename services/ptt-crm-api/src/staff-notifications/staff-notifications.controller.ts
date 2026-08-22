import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffNotificationsService } from './staff-notifications.service';

@Controller('api/v1/staff/notifications')
@UseGuards(StaffOrInternalKeyGuard)
export class StaffNotificationsController {
  constructor(private readonly notifications: StaffNotificationsService) {}

  @Get()
  list(
    @Req() req: Request & { staffUser?: StaffJwtPayload },
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    const unreadOnly = unread === '1' || unread === 'true';
    return this.notifications.list(req.staffUser, unreadOnly, limit);
  }

  @Post(':id/read')
  markRead(@Req() req: Request & { staffUser?: StaffJwtPayload }, @Param('id') id: string) {
    return this.notifications.markRead(req.staffUser, id);
  }
}
