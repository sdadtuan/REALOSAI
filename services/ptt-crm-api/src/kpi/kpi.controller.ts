import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import {
  StaffKpiViewGuard,
  StaffKpiWriteGuard,
} from './guards/staff-kpi.guard';
import { KpiService } from './kpi.service';
import { CreateKpiMetricBody, PatchKpiMetricBody } from './kpi.types';

@Controller('api/crm/kpi')
@UseGuards(StaffOrInternalKeyGuard, StaffKpiViewGuard)
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Get('board')
  board(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('team') team?: string,
  ) {
    return this.kpi.boardSummary(year, month, team);
  }

  @Get('solution')
  solution(
    @Query('team') team?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('period') period?: string,
  ) {
    return this.kpi.solutionDashboard(team, year, month, period);
  }

  @Get('alerts')
  alerts(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('staff_id') staffId?: string,
    @Query('team') team?: string,
  ) {
    return this.kpi.listAlerts(year, month, staffId, team);
  }

  @Get('chart')
  chart(
    @Query('metric_id') metricId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('staff_id') staffId?: string,
    @Query('team') team?: string,
  ) {
    return this.kpi.chart(metricId, year, month, staffId, team);
  }

  @Get('trend')
  trend(
    @Query('metric_id') metricId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('months') months?: string,
  ) {
    return this.kpi.metricTrend(metricId, year, month, months);
  }

  @Get('metrics')
  listMetrics(@Query('include_inactive') includeInactive?: string) {
    const raw = String(includeInactive ?? '').trim().toLowerCase();
    const include = raw === '1' || raw === 'true' || raw === 'yes' || raw === 'all';
    return this.kpi.listMetrics(include);
  }

  @Post('metrics')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffKpiWriteGuard)
  createMetric(@Body() body: CreateKpiMetricBody) {
    return this.kpi.createMetric(body);
  }

  @Patch('metrics/:id')
  @UseGuards(StaffKpiWriteGuard)
  patchMetric(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchKpiMetricBody,
  ) {
    return this.kpi.patchMetric(id, body);
  }
}
