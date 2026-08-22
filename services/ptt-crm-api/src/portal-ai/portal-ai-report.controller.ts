import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalAiReportService } from './portal-ai-report.service';
import { PortalAiReportSummaryResponse } from './portal-ai-report.types';

@Controller('api/v1/portal/ai')
@UseGuards(PortalJwtGuard)
export class PortalAiReportController {
  constructor(private readonly report: PortalAiReportService) {}

  @Get('report-summary')
  reportSummary(
    @PortalUser() user: PortalJwtPayload,
    @Query('days') days?: string,
  ): Promise<PortalAiReportSummaryResponse> {
    return this.report.reportSummary(user, days);
  }
}
