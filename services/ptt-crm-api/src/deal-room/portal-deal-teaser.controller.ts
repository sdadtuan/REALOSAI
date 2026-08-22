import { Controller, Get, Header, Param } from '@nestjs/common';
import { DealRoomService } from './deal-room.service';

@Controller('api/portal/deal-teaser')
export class PortalDealTeaserController {
  constructor(private readonly dealRoom: DealRoomService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  getTeaser(@Param('token') token: string) {
    return this.dealRoom.getPublicTeaser(token);
  }
}
