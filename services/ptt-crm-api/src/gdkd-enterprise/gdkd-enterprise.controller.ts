import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { GdkdEnterpriseKpiService } from './gdkd-enterprise-kpi.service';

@Controller('api/crm/gdkd-enterprise')
@UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
export class GdkdEnterpriseController {
  constructor(private readonly kpi: GdkdEnterpriseKpiService) {}

  /** GDKD enterprise KPI — 8 tiles SLA + AI + closed-loop with pass/fail gates. */
  @Get('kpi')
  getKpi(@Query('days') days?: string) {
    return this.kpi.getEnterpriseKpi({ days: days ? Number(days) : undefined });
  }
}
