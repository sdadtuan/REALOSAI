import {
  Body,
  Controller,
  Delete,
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
import { StaffOrdersViewGuard, StaffOrdersWriteGuard } from './guards/staff-orders.guard';
import { OrdersService } from './orders.service';
import { CreateOrderBody, CreateOrderLineBody, PatchOrderBody } from './orders.types';

@Controller('api/crm/orders')
@UseGuards(StaffOrInternalKeyGuard, StaffOrdersViewGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Query('customer_id') customerId?: string,
    @Query('lifecycle_id') lifecycleId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.list({ customer_id: customerId, lifecycle_id: lifecycleId, status, limit });
  }

  @Get(':id/lines')
  lines(@Param('id', ParseIntPipe) id: number) {
    return { lines: this.orders.detail(id).order.lines ?? [] };
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.orders.detail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrdersWriteGuard)
  create(@Body() body: CreateOrderBody) {
    return this.orders.create(body);
  }

  /** RNOS-25 / CRM-UC-006 step 9 — convert signed proposal to sales order. */
  @Post('from-proposal/:proposalId')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrdersWriteGuard)
  convertFromProposal(@Param('proposalId', ParseIntPipe) proposalId: number) {
    return this.orders.convertFromProposal(proposalId);
  }

  @Patch(':id')
  @UseGuards(StaffOrdersWriteGuard)
  patch(@Param('id', ParseIntPipe) id: number, @Body() body: PatchOrderBody) {
    return this.orders.patch(id, body);
  }

  @Post(':id/confirm')
  @UseGuards(StaffOrdersWriteGuard)
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.orders.confirm(id);
  }

  @Post(':id/cancel')
  @UseGuards(StaffOrdersWriteGuard)
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.orders.cancel(id);
  }

  @Post(':id/lines')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrdersWriteGuard)
  addLine(@Param('id', ParseIntPipe) id: number, @Body() body: CreateOrderLineBody) {
    return this.orders.addLine(id, body);
  }

  @Delete('lines/:lineId')
  @UseGuards(StaffOrdersWriteGuard)
  deleteLine(@Param('lineId', ParseIntPipe) lineId: number) {
    return this.orders.deleteLine(lineId);
  }
}
