import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsUiGuard } from '../guards/bds-ui.guard';
import { BdsStaffKpiService } from './bds-staff-kpi.service';

@Controller('api/v1/bds/kpi')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsUiGuard)
export class BdsStaffKpiController {
  constructor(private readonly kpi: BdsStaffKpiService) {}

  @Get('staff/:staffId/metrics')
  staffMetrics(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Headers('x-bds-tenant') tenantId: string | undefined,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.kpi.staffMetrics(staffId, String(tenantId ?? ''), year, month);
  }
}
