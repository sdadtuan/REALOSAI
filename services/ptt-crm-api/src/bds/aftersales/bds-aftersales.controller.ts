import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsAftersalesGuard } from '../guards/bds-aftersales.guard';
import { BdsAftersalesService } from './bds-aftersales.service';

type StaffReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsAftersalesGuard)
export class BdsAftersalesController {
  constructor(
    private readonly aftersales: BdsAftersalesService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private async resolveApproveCap(req?: StaffReq): Promise<boolean> {
    if (req?.staffAuthVia === 'internal') return true;
    const positionId = req?.staffUser?.position_id;
    if (positionId == null) return false;
    return this.staffAuth.hasCapForPosition(positionId, 'bds_aftersales', 'approve');
  }

  @Get('aftersales')
  listBoard(
    @Headers('x-bds-tenant') tenantId: string,
    @Query('project_id', new ParseIntPipe({ optional: true })) projectId?: number,
  ) {
    return this.aftersales.listBoard(String(tenantId ?? ''), projectId);
  }

  @Get('transactions/:id/aftersales')
  getDetail(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.aftersales.getDetail(id, tenantId);
  }

  @Post('transactions/:id/handover-appointment')
  @HttpCode(HttpStatus.OK)
  scheduleAppointment(
    @Param('id') id: string,
    @Body() body: { scheduled_at?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.aftersales.scheduleAppointment(id, String(body.scheduled_at ?? ''), tenantId);
  }

  @Post('transactions/:id/handover-check')
  @HttpCode(HttpStatus.OK)
  upsertCheck(
    @Param('id') id: string,
    @Body() body: { item_code?: string; status?: string; note?: string },
    @Headers('x-bds-tenant') tenantId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.aftersales.upsertCheck(id, body, tenantId, req?.staffUser?.position_id ?? null);
  }

  @Post('transactions/:id/handover')
  @HttpCode(HttpStatus.OK)
  async handover(
    @Param('id') id: string,
    @Body() body: { waive?: boolean; waive_reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
    @Req() req?: StaffReq,
  ) {
    const hasApproveCap = await this.resolveApproveCap(req);
    return this.aftersales.handover(
      id,
      {
        waive: body.waive,
        waive_reason: body.waive_reason,
        hasApproveCap,
        waived_by: req?.staffUser?.position_id ?? null,
      },
      tenantId,
    );
  }

  @Post('transactions/:id/defects')
  @HttpCode(HttpStatus.CREATED)
  createDefect(
    @Param('id') id: string,
    @Body() body: { kind?: string; title?: string; body?: string },
    @Headers('x-bds-tenant') tenantId?: string,
    @Req() req?: StaffReq,
  ) {
    return this.aftersales.createTicket(
      id,
      { kind: body.kind ?? 'defect', title: body.title, body: body.body },
      tenantId,
      req?.staffUser?.position_id ?? null,
    );
  }

  @Patch('aftersales-tickets/:id')
  patchTicket(
    @Param('id') id: string,
    @Body() body: { status?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.aftersales.patchTicket(id, String(body.status ?? ''), tenantId);
  }

  @Post('transactions/:id/title')
  @HttpCode(HttpStatus.OK)
  setTitle(
    @Param('id') id: string,
    @Body() body: { title_status?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.aftersales.setTitle(id, String(body.title_status ?? ''), tenantId);
  }
}
