import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsCommissionGuard } from '../guards/bds-commission.guard';
import { BdsCommissionScoreService } from './bds-commission-score.service';
import { BdsCommissionService } from './bds-commission.service';
import type { InsertSchemeTierInput, InsertSplitInput, SchemeBase } from './bds-commission.types';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsCommissionGuard)
export class BdsCommissionController {
  constructor(
    private readonly commission: BdsCommissionService,
    private readonly score: BdsCommissionScoreService,
  ) {}

  @Post('commission-schemes')
  @HttpCode(HttpStatus.CREATED)
  createScheme(
    @Body() body: { project_id: number; phase_id?: string; base?: SchemeBase },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.createScheme(body, tenantId);
  }

  @Post('commission-schemes/:id/tiers')
  @HttpCode(HttpStatus.OK)
  putTiers(
    @Param('id') id: string,
    @Body() body: { tiers: InsertSchemeTierInput[] },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.putTiers(id, body.tiers ?? [], tenantId);
  }

  @Post('commission-schemes/:id/splits')
  @HttpCode(HttpStatus.OK)
  putSplits(
    @Param('id') id: string,
    @Body() body: { splits: InsertSplitInput[] },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.putSplits(id, body.splits ?? [], tenantId);
  }

  @Post('commission-schemes/:id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.commission.activate(id, tenantId);
  }

  @Get('commissions')
  listCommissions(
    @Query('agency_id') agencyId: string,
    @Query('period') period: string,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.listCommissions(agencyId, period, tenantId);
  }

  @Post('commission-statements/lock')
  @HttpCode(HttpStatus.OK)
  lockStatement(
    @Body() body: { agency_id: string; period_month: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.lockStatement(body.agency_id, body.period_month, tenantId);
  }

  @Post('commission-statements/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveStatement(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.commission.approveStatement(id, tenantId);
  }

  @Post('commission-statements/:id/pay')
  @HttpCode(HttpStatus.OK)
  payStatement(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.commission.payStatement(id, tenantId);
  }

  @Post('commission-advances')
  @HttpCode(HttpStatus.CREATED)
  createAdvance(
    @Body() body: { agency_id: string; amount_vnd: number; period_month: string; note?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.commission.createAdvance(body, tenantId);
  }

  @Post('tiers/recalc')
  @HttpCode(HttpStatus.OK)
  recalcTiers(
    @Body() body: { period_month: string; targets?: { agencyId: string; target_gmv: number; target_units: number }[] },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.score.recalc(body.period_month, tenantId, { targets: body.targets });
  }
}
