import { Body, Controller, Delete, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from './portal-jwt.guard';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalMobileService, RegisterNativeDeviceBody } from './portal-mobile.service';

@Controller('api/v1/mobile')
export class PortalMobileController {
  constructor(private readonly mobile: PortalMobileService) {}

  @Get('config')
  getConfig(@Headers('x-ptt-app-version') appVersion?: string) {
    return this.mobile.getConfig(appVersion ?? null);
  }

  @Post('device-token')
  @UseGuards(PortalJwtGuard)
  registerDevice(@PortalUser() user: PortalJwtPayload, @Body() body: RegisterNativeDeviceBody) {
    return this.mobile.registerDevice(user, body ?? ({} as RegisterNativeDeviceBody));
  }

  @Delete('device-token')
  @UseGuards(PortalJwtGuard)
  unregisterDevice(@PortalUser() user: PortalJwtPayload, @Query('token') token?: string) {
    return this.mobile.unregisterDevice(user, token ?? '');
  }

  @Post('push/test')
  @UseGuards(PortalJwtGuard)
  testNativePush(@PortalUser() user: PortalJwtPayload) {
    return this.mobile.testNativePush(user);
  }
}
