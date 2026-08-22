import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from './portal-jwt.guard';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalPushService, PortalPushSubscribeBody } from './portal-push.service';

@Controller('api/v1/portal/push')
export class PortalPushController {
  constructor(private readonly push: PortalPushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.push.getVapidPublicKey();
  }

  @Post('subscribe')
  @UseGuards(PortalJwtGuard)
  subscribe(@PortalUser() user: PortalJwtPayload, @Body() body: PortalPushSubscribeBody) {
    return this.push.subscribe(user, body ?? ({} as PortalPushSubscribeBody));
  }

  @Delete('subscribe')
  @UseGuards(PortalJwtGuard)
  unsubscribe(@PortalUser() user: PortalJwtPayload, @Query('endpoint') endpoint?: string) {
    return this.push.unsubscribe(user, endpoint ?? '');
  }

  @Post('test')
  @UseGuards(PortalJwtGuard)
  test(@PortalUser() user: PortalJwtPayload) {
    return this.push.testForUser(user);
  }
}
