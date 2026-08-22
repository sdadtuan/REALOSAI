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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { parseNumericStaffSub } from '../staff-auth/staff-user-id.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffChatGuard } from './staff-chat.guard';
import { StaffChatService } from './staff-chat.service';
import type { CreateRoomBody, PostMessageBody } from './staff-chat.types';

type StaffReq = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/staff-chat')
@UseGuards(StaffOrInternalKeyGuard, StaffChatGuard)
export class StaffChatController {
  constructor(
    private readonly chat: StaffChatService,
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

  private async hasTxView(req?: StaffReq): Promise<boolean> {
    if (req?.staffAuthVia === 'internal') return true;
    const positionId = req?.staffUser?.position_id;
    if (positionId == null) return false;
    return this.staffAuth.hasCapForPosition(positionId, 'bds_transactions', 'view');
  }

  private async canModerate(req?: StaffReq): Promise<boolean> {
    if (req?.staffAuthVia === 'internal') return true;
    const positionId = req?.staffUser?.position_id;
    if (positionId == null) return false;
    return this.staffAuth.hasCapForPosition(positionId, 'staff_chat', 'moderate');
  }

  @Get('rooms')
  listRooms(@Headers('x-bds-tenant') tenantId: string, @Req() req: StaffReq) {
    return this.chat.listRooms(this.staffId(req), this.tenant(tenantId));
  }

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  createRoom(
    @Body() body: CreateRoomBody,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.chat.createRoom(body, this.staffId(req), this.tenant(tenantId));
  }

  @Get('rooms/:id')
  getRoom(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.chat.getRoom(id, this.staffId(req), this.tenant(tenantId));
  }

  @Get('rooms/:id/messages')
  async listMessages(
    @Param('id') id: string,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Query('before_id') beforeId?: string,
  ) {
    return this.chat.listMessages(id, this.staffId(req), this.tenant(tenantId), {
      beforeId,
      hasTxView: await this.hasTxView(req),
    });
  }

  @Post('rooms/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  postMessage(
    @Param('id') id: string,
    @Body() body: PostMessageBody,
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.chat.postMessage(
      id,
      this.staffId(req),
      { ...body, idempotency_key: idempotencyKey ?? body.idempotency_key ?? null },
      this.tenant(tenantId),
    );
  }

  @Post('rooms/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('id') id: string,
    @Body() body: { message_id?: string },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.chat.markRead(id, this.staffId(req), String(body.message_id ?? ''), this.tenant(tenantId));
  }

  @Patch('messages/:id')
  editMessage(
    @Param('id') id: string,
    @Body() body: { body?: string },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.chat.editMessage(id, this.staffId(req), String(body.body ?? ''), this.tenant(tenantId));
  }

  @Post('messages/:id/tombstone')
  async tombstone(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('x-bds-tenant') tenantId: string,
    @Req() req: StaffReq,
  ) {
    return this.chat.tombstone(id, this.staffId(req), String(body.reason ?? ''), this.tenant(tenantId), {
      canModerate: await this.canModerate(req),
    });
  }
}
