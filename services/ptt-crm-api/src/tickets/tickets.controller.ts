import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from '../cases/guards/staff-cases.guard';
import { TicketsService } from './tickets.service';
import type { CreateTicketBody, CreateTicketMessageBody, PatchTicketBody } from './tickets.types';

@Controller('api/crm/tickets')
@UseGuards(StaffOrInternalKeyGuard, StaffCasesViewGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('sentiment') sentiment?: string,
    @Query('customer_id') customerId?: string,
    @Query('assigned_staff_id') assignedStaffId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const cid = customerId ? Number(customerId) : undefined;
    const sid = assignedStaffId ? Number(assignedStaffId) : undefined;
    return this.tickets.list({
      q,
      status,
      priority,
      sentiment,
      customer_id: cid && Number.isFinite(cid) ? cid : undefined,
      assigned_staff_id: sid && Number.isFinite(sid) ? sid : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id/messages')
  listMessages(@Param('id', ParseIntPipe) id: number) {
    return { messages: this.tickets.listMessages(id) };
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.getById(id);
  }

  @Post()
  @UseGuards(StaffCasesWriteGuard)
  create(@Body() body: CreateTicketBody) {
    return this.tickets.create(body);
  }

  @Post(':id/messages')
  @UseGuards(StaffCasesWriteGuard)
  addMessage(@Param('id', ParseIntPipe) id: number, @Body() body: CreateTicketMessageBody) {
    return this.tickets.addMessage(id, body);
  }

  @Patch(':id')
  @UseGuards(StaffCasesWriteGuard)
  patch(@Param('id', ParseIntPipe) id: number, @Body() body: PatchTicketBody) {
    return this.tickets.patch(id, body);
  }
}
