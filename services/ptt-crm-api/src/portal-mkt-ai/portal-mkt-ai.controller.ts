import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalMktAiSummaryService } from './portal-mkt-ai-summary.service';
import type { MktAiPortalLinkedLifecycle, MktAiPortalSummary } from './portal-mkt-ai-summary.types';

@Controller('api/v1/portal/service-lifecycle')
@UseGuards(PortalJwtGuard)
export class PortalMktAiController {
  constructor(private readonly summary: PortalMktAiSummaryService) {}

  @Get('linked')
  linked(@PortalUser() user: PortalJwtPayload): Promise<MktAiPortalLinkedLifecycle> {
    return this.summary.linkedLifecycle(user);
  }

  @Get(':lifecycleId/ai-planner/summary')
  planSummary(
    @PortalUser() user: PortalJwtPayload,
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
  ): Promise<MktAiPortalSummary> {
    return this.summary.planSummary(user, lifecycleId);
  }
}
