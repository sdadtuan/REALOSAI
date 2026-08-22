import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffInvoicesViewGuard, StaffInvoicesWriteGuard } from './guards/staff-invoices.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceBody, IssueInvoiceBody, PatchInvoiceBody } from './invoices.types';

@Controller('api/crm/invoices')
@UseGuards(StaffOrInternalKeyGuard, StaffInvoicesViewGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(
    @Query('customer_id') customerId?: string,
    @Query('lifecycle_id') lifecycleId?: string,
    @Query('status') status?: string,
    @Query('overdue') overdue?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoices.list({ customer_id: customerId, lifecycle_id: lifecycleId, status, overdue, limit });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.detail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffInvoicesWriteGuard)
  create(@Body() body: CreateInvoiceBody) {
    return this.invoices.create(body);
  }

  /** RNOS-25 / CRM-UC-006 step 10 — issue invoice from confirmed order. */
  @Post('from-order/:orderId')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffInvoicesWriteGuard)
  createFromOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: IssueInvoiceBody,
  ) {
    return this.invoices.createFromOrder(orderId, body);
  }

  @Patch(':id')
  @UseGuards(StaffInvoicesWriteGuard)
  patch(@Param('id', ParseIntPipe) id: number, @Body() body: PatchInvoiceBody) {
    return this.invoices.patch(id, body);
  }

  @Post(':id/issue')
  @UseGuards(StaffInvoicesWriteGuard)
  issue(@Param('id', ParseIntPipe) id: number, @Body() body: IssueInvoiceBody) {
    return this.invoices.issue(id, body);
  }

  @Post(':id/void')
  @UseGuards(StaffInvoicesWriteGuard)
  voidInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.void(id);
  }

  @Post(':id/sync-paid')
  @UseGuards(StaffInvoicesWriteGuard)
  syncPaid(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.syncPaid(id);
  }
}
