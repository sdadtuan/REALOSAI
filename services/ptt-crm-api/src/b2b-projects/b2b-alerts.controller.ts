import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { MessageEvent } from '@nestjs/common/interfaces';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { StaffLeadsViewGuard } from '../leads/guards/staff-leads-view.guard';
import { B2bAlertStreamService } from './b2b-alert-stream.service';
import { B2bAlertsService } from './b2b-alerts.service';

type ReqWithStaff = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/b2b-lead-alerts')
@UseGuards(StaffOrInternalKeyGuard, StaffLeadsViewGuard)
export class B2bAlertsController {
  constructor(
    private readonly alerts: B2bAlertsService,
    private readonly stream: B2bAlertStreamService,
    private readonly staffAuth: StaffAuthService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  async list(
    @Query('scope') scope: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: ReqWithStaff,
  ) {
    const me = req.staffUser ? await this.staffAuth.me(req.staffUser) : null;
    const staffId = req.staffUser ? await this.staffAuth.resolveCrmStaffUserId(req.staffUser) : null;
    const scopeAll =
      req.staffAuthVia === 'internal' ||
      (scope === 'all' && me != null && hasGdkdViewAllLeads(me.caps));
    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    const items = await this.alerts.listInbox({
      staffId: staffId ?? undefined,
      scopeAll,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return { items };
  }

  @Get('stream')
  @Sse()
  alertStream(
    @Req() req: ReqWithStaff,
  ): Observable<MessageEvent> {
    if (!this.config.b2bSse) {
      throw new NotFoundException({ error: 'sse_disabled' });
    }
    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'staff_required' });
    }
    return this.stream.streamForStaff(req.staffUser);
  }
}
