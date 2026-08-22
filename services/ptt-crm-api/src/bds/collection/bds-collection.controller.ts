import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsCollectionGuard } from '../guards/bds-collection.guard';
import { BdsCollectionService } from './bds-collection.service';
import type { CreateReceiptBody } from './bds-collection.types';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsCollectionGuard)
export class BdsCollectionController {
  constructor(private readonly collection: BdsCollectionService) {}

  @Post('receipts')
  @HttpCode(HttpStatus.CREATED)
  createReceipt(
    @Body() body: CreateReceiptBody,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.collection.createReceipt(
      {
        transaction_id: String(body.transaction_id ?? ''),
        installment_id: body.installment_id,
        receipt_no: body.receipt_no,
        amount_vnd: Number(body.amount_vnd),
        paid_at: body.paid_at,
        method: body.method,
        note: body.note,
        created_by: body.created_by,
      },
      tenantId,
    );
  }

  @Get('collections/aging')
  listAging(
    @Query('project_id', ParseIntPipe) projectId: number,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.collection.listAging(projectId, tenantId);
  }

  @Get('collections/export')
  async exportCsv(
    @Query('project_id', ParseIntPipe) projectId: number,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.collection.exportReceiptsCsv(projectId, from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bds-receipts.csv"');
    return csv;
  }
}
