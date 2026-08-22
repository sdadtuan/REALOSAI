import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { MarketResearchEnabledGuard } from '../market-research/guards/market-research-enabled.guard';
import type { PortalRagSearchInput, PortalReportsListInput } from '../market-research/market-research.types';
import { PortalJwtGuard, PortalUser } from '../portal/portal-jwt.guard';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalResearchService } from './portal-research.service';

@Controller('api/v1/portal/research')
@UseGuards(PortalJwtGuard, MarketResearchEnabledGuard)
export class PortalResearchController {
  constructor(private readonly research: PortalResearchService) {}

  @Get('health')
  health() {
    return this.research.health();
  }

  @Get('insights/search')
  searchInsights(@PortalUser() user: PortalJwtPayload, @Query() query: PortalRagSearchInput) {
    return this.research.searchInsights(user, query);
  }

  @Get('analytics/themes')
  getThemeQuarterAnalytics(
    @PortalUser() user: PortalJwtPayload,
    @Query('year') yearStr?: string,
  ) {
    const year =
      yearStr != null && yearStr.trim() !== '' ? Number(yearStr.trim()) : undefined;
    return this.research.getThemeQuarterAnalytics(user, year);
  }

  @Get('conjoint')
  getConjoint(@PortalUser() user: PortalJwtPayload) {
    return this.research.getConjoint(user);
  }

  @Get('reports')
  list(@PortalUser() user: PortalJwtPayload, @Query() query: PortalReportsListInput) {
    return this.research.listReports(user, query);
  }

  @Get('reports/:versionId/export.pdf')
  exportPdf(
    @PortalUser() user: PortalJwtPayload,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.research.exportReportPdf(user, versionId);
  }

  @Get('reports/:versionId')
  detail(
    @PortalUser() user: PortalJwtPayload,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.research.getReport(user, versionId);
  }
}
