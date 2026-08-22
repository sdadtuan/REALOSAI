import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { StaffLeadsWriteGuard } from '../leads/guards/staff-leads-write.guard';
import {
  LeadsFunnelEnabledGuard,
  PresalesOnLeadGuard,
} from '../leads-funnel/guards/leads-funnel-enabled.guard';
import type { ExportDealRoomPackBody } from './deal-room-export.types';
import { DealRoomEnabledGuard } from './guards/deal-room-enabled.guard';
import { DealRoomService } from './deal-room.service';

type StaffReq = Request & { staffUser?: StaffJwtPayload };

@Controller('api/v1/leads')
@UseGuards(LeadsFunnelEnabledGuard, DealRoomEnabledGuard)
export class DealRoomController {
  constructor(private readonly dealRoom: DealRoomService) {}

  @Get(':id/deal-room')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  getDealRoom(@Param('id', ParseIntPipe) id: number) {
    return this.dealRoom.getSnapshot(id);
  }

  @Post(':id/deal-room/export-pack')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard, PresalesOnLeadGuard)
  @Header('Cache-Control', 'no-store')
  exportPack(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ExportDealRoomPackBody,
    @Req() req: StaffReq,
  ) {
    const actor = req.staffUser?.email ?? 'staff';
    const userId = req.staffUser?.sub != null ? Number(req.staffUser.sub) : null;
    return this.dealRoom.exportPack(id, body ?? {}, actor, Number.isFinite(userId) ? userId : null);
  }

  @Post(':id/deal-room/teaser')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard)
  createTeaser(@Param('id', ParseIntPipe) id: number, @Req() req: StaffReq) {
    const actor = req.staffUser?.email ?? 'staff';
    const userId = req.staffUser?.sub != null ? Number(req.staffUser.sub) : null;
    return this.dealRoom.createTeaser(id, actor, Number.isFinite(userId) ? userId : null);
  }

  @Delete(':id/deal-room/teaser')
  @UseGuards(StaffOrInternalKeyGuard, StaffLeadsWriteGuard, PresalesOnLeadGuard)
  revokeTeaser(@Param('id', ParseIntPipe) id: number, @Req() req: StaffReq) {
    const actor = req.staffUser?.email ?? 'staff';
    const userId = req.staffUser?.sub != null ? Number(req.staffUser.sub) : null;
    return this.dealRoom.revokeTeaser(id, actor, Number.isFinite(userId) ? userId : null);
  }
}
