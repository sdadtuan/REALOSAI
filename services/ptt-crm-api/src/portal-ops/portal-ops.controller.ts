import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalOpsSummaryService } from './portal-ops-summary.service';
import type { OpsPortalLinkedLifecycle, OpsPortalSummary } from './portal-ops.types';

@Controller('api/v1/portal/ops')
@UseGuards(PortalJwtGuard)
export class PortalOpsController {
  constructor(private readonly summary: PortalOpsSummaryService) {}

  @Get('linked')
  linked(@PortalUser() user: PortalJwtPayload): Promise<OpsPortalLinkedLifecycle> {
    return this.summary.linkedLifecycle(user);
  }

  @Get('lifecycle/:lifecycleId/summary')
  lifecycleSummary(
    @PortalUser() user: PortalJwtPayload,
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
  ): Promise<OpsPortalSummary> {
    return this.summary.lifecycleSummary(user, lifecycleId);
  }
}
