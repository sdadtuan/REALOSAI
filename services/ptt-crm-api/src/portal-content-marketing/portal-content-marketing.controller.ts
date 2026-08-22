import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalContentMarketingSummaryService } from './portal-content-marketing-summary.service';

@Controller('api/v1/portal/service-lifecycle')
@UseGuards(PortalJwtGuard)
export class PortalContentMarketingController {
  constructor(private readonly summary: PortalContentMarketingSummaryService) {}

  @Get(':lifecycleId/content-summary')
  contentSummary(
    @PortalUser() user: PortalJwtPayload,
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
  ) {
    return this.summary.contentSummary(user, lifecycleId);
  }

  @Post(':lifecycleId/content-marketing/items/:itemId/client-approve')
  @HttpCode(HttpStatus.OK)
  clientApprove(
    @PortalUser() user: PortalJwtPayload,
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.summary.portalClientApprove(user, lifecycleId, itemId);
  }

  @Post(':lifecycleId/content-marketing/items/:itemId/client-reject')
  @HttpCode(HttpStatus.OK)
  clientReject(
    @PortalUser() user: PortalJwtPayload,
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.summary.portalClientReject(user, lifecycleId, itemId, body);
  }
}
