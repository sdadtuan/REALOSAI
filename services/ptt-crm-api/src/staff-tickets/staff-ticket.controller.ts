import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { parseNumericStaffSub } from '../staff-auth/staff-user-id.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffTicketGuard } from './staff-ticket.guard';
import { StaffTicketService } from './staff-ticket.service';
import type { CreateTicketBody, ListTicketsFilter } from './staff-ticket.types';

type StaffReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/staff-tickets')
@UseGuards(StaffOrInternalKeyGuard, StaffTicketGuard)
export class StaffTicketController {
  constructor(
    private readonly tickets: StaffTicketService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private staffId(req?: StaffReq): number {
    const n = parseNumericStaffSub(req?.staffUser?.sub);
    if (n == null) throw new NotFoundException();
    return n;
  }

  private tenant(tenantId?: string): string {
    const t = String(tenantId ?? '').trim();
    if (!t) throw new NotFoundException();
    return t;
  }

  private async canAssign(req?: StaffReq): Promise<boolean> {
    if (req?.staffAuthVia === 'internal') return true;
    const positionId = req?.staffUser?.position_id;
    if (positionId == null) return false;
    return this.staffAuth.hasCapForPosition(positionId, 'staff_tickets', 'assign');
  }

  private async canExport(req?: StaffReq): Promise<boolean> {
    if (req?.staffAuthVia === 'internal') return true;
    const positionId = req?.staffUser?.position_id;
    if (positionId == null) return false;
    return this.staffAuth.hasCapForPosition(positionId, 'staff_tickets', 'export');
  }

  @Get('queues')
  listQueues(@Headers('x-bds-tenant') tenantId: string) {
    return this.tickets.listQueues(this.tenant(tenantId));
  }

  @Get('tickets')
  listTickets(
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Query('inbox') inbox?: ListTicketsFilter['inbox'],
    @Query('queue') queue?: string,
    @Query('overdue') overdue?: string,
    @Query('project_id') projectId?: string,
  ) {
    return this.tickets.listTickets(this.staffId(req), this.tenant(tenantId), {
      inbox,
      queue,
      overdue: overdue === '1' || overdue === 'true',
      projectId: projectId ? Number(projectId) : undefined,
    });
  }

  @Get('board')
  board(
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Query('inbox') inbox?: ListTicketsFilter['inbox'],
  ) {
    return this.tickets.listTickets(this.staffId(req), this.tenant(tenantId), { inbox });
  }

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreateTicketBody,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.tickets.createTicket(this.staffId(req), this.tenant(tenantId), {
      ...body,
      idempotency_key: idempotencyKey ?? body.idempotency_key ?? null,
    });
  }

  @Get('export')
  async exportCsv(
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Res() res: Response,
    @Query('inbox') inbox?: ListTicketsFilter['inbox'],
    @Query('queue') queue?: string,
    @Query('project_id') projectId?: string,
  ) {
    if (!(await this.canExport(req))) throw new NotFoundException();
    const csv = await this.tickets.exportCsv(this.staffId(req), this.tenant(tenantId), {
      inbox,
      queue,
      projectId: projectId ? Number(projectId) : undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="staff-tickets.csv"');
    res.send(csv);
  }

  @Post('bulk/ops-action')
  @HttpCode(HttpStatus.CREATED)
  bulkOpsAction(
    @Body() body: { items: Array<{ title: string; body?: string; assignee_staff_id?: number; project_id?: number }> },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.bulkOpsAction(this.staffId(req), this.tenant(tenantId), body.items ?? []);
  }

  @Get('tickets/:id/comments')
  listComments(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.listComments(id, this.staffId(req), this.tenant(tenantId));
  }

  @Get('tickets/:id/events')
  listEvents(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.listEvents(id, this.staffId(req), this.tenant(tenantId));
  }

  @Get('tickets/:id')
  getTicket(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.getTicket(id, this.staffId(req), this.tenant(tenantId));
  }

  @Patch('tickets/:id')
  patchTicket(
    @Param('id') id: string,
    @Body() body: { title?: string; body?: string; priority?: CreateTicketBody['priority'] },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.patchTicket(id, this.staffId(req), this.tenant(tenantId), body);
  }

  @Post('tickets/:id/assign')
  async assign(
    @Param('id') id: string,
    @Body() body: { staff_id?: number },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.assign(id, this.staffId(req), body, this.tenant(tenantId), {
      canAssign: await this.canAssign(req),
    });
  }

  @Post('tickets/:id/transition')
  transition(
    @Param('id') id: string,
    @Body() body: { to: 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' | 'cancelled'; reason?: string; comment?: string },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.transition(id, this.staffId(req), body, this.tenant(tenantId));
  }

  @Post('tickets/:id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  watch(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.tickets.watch(id, this.staffId(req), this.tenant(tenantId));
  }
}
