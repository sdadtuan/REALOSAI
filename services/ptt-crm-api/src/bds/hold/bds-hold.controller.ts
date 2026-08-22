import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsHoldService } from './bds-hold.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard)
export class BdsHoldController {
  constructor(private readonly holds: BdsHoldService) {}

  @Post('units/:id/holds')
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { lead_id?: number; row_version?: number; channel_partner_id?: string; note?: string },
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.holds.create(id, {
      lead_id: Number(body.lead_id),
      row_version: Number(body.row_version),
      channel_partner_id: body.channel_partner_id,
      note: body.note,
    }, { tenantId, idempotencyKey });
  }

  @Get('holds/:id')
  get(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.holds.get(id, tenantId);
  }

  @Get('projects/:id/holds')
  listByProject(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.holds.listByProject(id, tenantId);
  }

  @Post('holds/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() body: { approved_by?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.holds.approve(id, String(body.approved_by ?? ''), tenantId);
  }

  @Post('holds/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.holds.reject(id, String(body.reason ?? ''), tenantId);
  }

  @Post('holds/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.holds.cancel(id, String(body.reason ?? ''), tenantId);
  }
}
