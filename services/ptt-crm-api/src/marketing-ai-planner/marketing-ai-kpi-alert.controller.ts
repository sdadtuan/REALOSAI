import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

@Controller('api/crm/mkt-ai-planner')
@UseGuards(StaffOrInternalKeyGuard)
export class MarketingAiKpiAlertController {
  constructor(private readonly planner: MarketingAiPlannerService) {}

  @Get('alerts/status')
  status() {
    return this.planner.getKpiAlertStatus();
  }

  @Post('alerts/run')
  @HttpCode(HttpStatus.OK)
  run(@Body() body: { dry_run?: boolean }) {
    return this.planner.runKpiAlertScan({ dryRun: body?.dry_run === true });
  }

  @Get('weekly-memo/status')
  weeklyMemoStatus() {
    return this.planner.getWeeklyMemoStatus();
  }

  @Post('weekly-memo/run')
  @HttpCode(HttpStatus.OK)
  runWeeklyMemo(@Body() body: { dry_run?: boolean }) {
    return this.planner.runWeeklyMemoCron({ dryRun: body?.dry_run === true });
  }

  @Get('closed-loop/status')
  closedLoopStatus() {
    return this.planner.getKpiClosedLoopStatus();
  }
}
