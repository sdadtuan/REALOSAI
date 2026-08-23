import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import type { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsBuyerGuard } from '../guards/bds-buyer.guard';
import { BdsBuyerQueryService } from './bds-buyer-query.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload };

@Controller('api/v1/bds/spine')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsBuyerGuard)
export class BdsSpineBuyerController {
  constructor(
    private readonly buyerQuery: BdsBuyerQueryService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  @Get('buyer/:leadId')
  async getBuyer(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Headers('x-bds-tenant') tenantId?: string,
    @Req() req?: StaffReq,
  ) {
    let viewPii = false;
    if (req?.staffUser) {
      const me = await this.staffAuth.me(req.staffUser);
      viewPii = this.staffAuth.hasCap(me.caps, 'bds_buyers', 'view_pii');
    }
    const tid = String(tenantId ?? '').trim();
    return this.buyerQuery.getByLeadId(leadId, tid || undefined, viewPii);
  }
}
