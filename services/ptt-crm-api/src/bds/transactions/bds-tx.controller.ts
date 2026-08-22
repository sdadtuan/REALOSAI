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
import { BdsTxGuard } from '../guards/bds-tx.guard';
import {
  BdsTxService,
  type ConvertDepositBody,
  type ContractBody,
  type ReservationBody,
  type VbttBody,
} from './bds-tx.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsTxGuard)
export class BdsTxController {
  constructor(private readonly txs: BdsTxService) {}

  @Post('holds/:id/convert-deposit')
  @HttpCode(HttpStatus.CREATED)
  convertDeposit(
    @Param('id') id: string,
    @Body() body: ConvertDepositBody,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.txs.convertDeposit(
      id,
      {
        deposit_vnd: Number(body.deposit_vnd),
        policy_id: String(body.policy_id ?? ''),
        row_version: Number(body.row_version),
        list_price_vnd: body.list_price_vnd,
        discount_pct: body.discount_pct,
        discount_approved: body.discount_approved,
        net_price_vnd: body.net_price_vnd,
      },
      { tenantId, idempotencyKey },
    );
  }

  @Post('holds/:id/reservation')
  @HttpCode(HttpStatus.CREATED)
  reservation(
    @Param('id') id: string,
    @Body() body: ReservationBody,
    @Headers('x-bds-tenant') tenantId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.txs.reservation(
      id,
      {
        reservation_fee_vnd: Number(body.reservation_fee_vnd),
        row_version: Number(body.row_version),
      },
      { tenantId, idempotencyKey },
    );
  }

  @Get('transactions/:id')
  get(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.txs.get(id, tenantId);
  }

  @Get('projects/:id/transactions')
  listByProject(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.txs.listByProject(id, tenantId);
  }

  @Post('transactions/:id/vbtt')
  @HttpCode(HttpStatus.OK)
  vbtt(
    @Param('id') id: string,
    @Body() body: VbttBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.txs.vbtt(id, { vbtt_no: String(body.vbtt_no ?? '') }, tenantId);
  }

  @Post('transactions/:id/contract')
  @HttpCode(HttpStatus.OK)
  contract(
    @Param('id') id: string,
    @Body() body: ContractBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.txs.contract(
      id,
      {
        contract_no: String(body.contract_no ?? ''),
        row_version: Number(body.row_version),
      },
      tenantId,
    );
  }

  @Post('transactions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.txs.cancel(id, String(body.reason ?? ''), tenantId);
  }
}
