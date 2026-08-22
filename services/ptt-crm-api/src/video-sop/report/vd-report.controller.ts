import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdProjectViewGuard } from '../guards/staff-vd-project.guard';
import { VdReportService } from './vd-report.service';

@Controller('api/v1/vd/reports')
@UseGuards(StaffOrInternalKeyGuard, StaffVdProjectViewGuard)
export class VdReportController {
  constructor(private readonly reports: VdReportService) {}

  @Get('production')
  getProduction(@Query('lifecycle_id', ParseIntPipe) lifecycleId: number) {
    return this.reports.getProductionReport(lifecycleId);
  }
}
