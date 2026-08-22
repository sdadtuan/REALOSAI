import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOpsViewGuard } from './guards/staff-ops-view.guard';
import { StaffOpsWriteGuard } from './guards/staff-ops-write.guard';
import { OpsAgentCronService } from './ops-agent-cron.service';
import { OpsDashboardService } from './ops-dashboard.service';
import { OpsService } from './ops.service';
import type { OpsKpiUpsertBody } from './ops.types';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

@Controller('api/ops')
@UseGuards(StaffOrInternalKeyGuard, StaffOpsViewGuard)
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly agent: OpsAgentCronService,
    private readonly dashboard: OpsDashboardService,
  ) {}

  @Get('health')
  health() {
    return this.ops.health();
  }

  @Get('catalog')
  getCatalog() {
    return this.ops.getCatalog();
  }

  @Get('catalog/:dvCode')
  getCatalogByCode(@Param('dvCode') dvCode: string) {
    return this.ops.getCatalogByCode(dvCode);
  }

  @Get('lifecycle/:lifecycleId/hub')
  getHub(@Param('lifecycleId', ParseIntPipe) lifecycleId: number) {
    return this.ops.getHub(lifecycleId);
  }

  @Post('lifecycle/:lifecycleId/spawn-week')
  @UseGuards(StaffOpsWriteGuard)
  spawnWeek(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Req() req: StaffReq) {
    const spawnedBy = req.staffUser?.email ?? req.staffAuthVia ?? 'staff';
    return this.ops.spawnWeek(lifecycleId, String(spawnedBy));
  }

  @Get('lifecycle/:lifecycleId/weekly')
  getWeekly(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('iso_week') isoWeek?: string,
  ) {
    return this.ops.getWeeklyChecklist(lifecycleId, isoWeek);
  }

  @Patch('lifecycle/:lifecycleId/weekly/:itemId')
  @UseGuards(StaffOpsWriteGuard)
  patchWeeklyItem(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { status?: 'pending' | 'done' | 'skipped' },
  ) {
    const status = body?.status ?? 'done';
    return this.ops.patchWeeklyItem(lifecycleId, itemId, status);
  }

  @Get('lifecycle/:lifecycleId/kpi')
  getKpi(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('period_type') periodType?: 'week' | 'month',
    @Query('period_key') periodKey?: string,
  ) {
    return this.ops.getKpiRecords(lifecycleId, periodType, periodKey);
  }

  @Put('lifecycle/:lifecycleId/kpi')
  @UseGuards(StaffOpsWriteGuard)
  putKpi(@Param('lifecycleId', ParseIntPipe) lifecycleId: number, @Body() body: OpsKpiUpsertBody) {
    return this.ops.upsertKpi(lifecycleId, body);
  }

  @Post('lifecycle/:lifecycleId/kpi/compute-labels')
  @UseGuards(StaffOpsWriteGuard)
  computeKpiLabels(
    @Param('lifecycleId', ParseIntPipe) lifecycleId: number,
    @Query('period_type') periodType?: 'week' | 'month',
    @Query('period_key') periodKey?: string,
  ) {
    return this.ops.computeKpiLabels(lifecycleId, periodType ?? 'month', periodKey);
  }

  @Get('alerts')
  listAlerts(
    @Query('lifecycle_id') lifecycleId?: string,
    @Query('status') status?: 'open' | 'acknowledged',
    @Query('limit') limit?: string,
  ) {
    const lc = lifecycleId ? Number(lifecycleId) : undefined;
    return this.ops.listAlerts({
      lifecycleId: lc && Number.isFinite(lc) ? lc : undefined,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('alerts/:alertId/ack')
  @UseGuards(StaffOpsWriteGuard)
  ackAlert(@Param('alertId', ParseIntPipe) alertId: number, @Req() req: StaffReq) {
    const actor = req.staffUser?.email ?? req.staffAuthVia ?? 'staff';
    return this.ops.acknowledgeAlert(alertId, String(actor));
  }

  @Get('agent/status')
  agentStatus() {
    return this.agent.agentStatus();
  }

  @Post('agent/run')
  @UseGuards(StaffOpsWriteGuard)
  runAgent(@Body() body: { dry_run?: boolean }) {
    return this.agent.runScan({ dryRun: body?.dry_run === true });
  }

  @Get('dashboard/am')
  dashboardAm(@Req() req: StaffReq, @Query('am_id') amId?: string) {
    const staffId = amId?.trim() || req.staffUser?.sub;
    const parsed = staffId ? Number(staffId) : undefined;
    return this.dashboard.getAmDashboard(parsed && Number.isFinite(parsed) ? parsed : undefined);
  }

  @Get('dashboard/team-lead')
  dashboardTeamLead(@Query('department') department?: string) {
    return this.dashboard.getTeamLeadDashboard(department?.trim() || undefined);
  }

  @Get('dashboard/specialist')
  dashboardSpecialist() {
    return this.dashboard.getSpecialistDashboard();
  }

  @Get('dashboard/executive')
  dashboardExecutive() {
    return this.dashboard.getExecutiveDashboard();
  }
}
