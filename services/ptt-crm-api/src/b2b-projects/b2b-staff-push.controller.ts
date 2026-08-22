import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AppConfigService } from '../config/app-config.service';
import { B2bStaffPushRepository } from './b2b-staff-push.repository';

type ReqWithStaff = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller('api/v1/b2b-staff-push')
@UseGuards(StaffOrInternalKeyGuard)
export class B2bStaffPushController {
  constructor(
    private readonly repo: B2bStaffPushRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly config: AppConfigService,
  ) {}

  @Get('vapid')
  vapidPublicKey() {
    const publicKey =
      (process.env.PTT_B2B_VAPID_PUBLIC ?? '').trim() || this.config.portalVapidPublicKey;
    return {
      ok: Boolean(publicKey),
      publicKey: publicKey ?? null,
      enabled: this.config.b2bPush,
    };
  }

  @Post('subscribe')
  async subscribe(
    @Body()
    body: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      fcm_token?: string;
    },
    @Req() req: ReqWithStaff,
  ) {
    if (!this.config.b2bPush) return { ok: true, skipped: true };
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) return { ok: false, error: 'staff_required' };

    if (body.fcm_token?.trim()) {
      // FCM native tokens stored via separate mobile flow — web uses endpoint keys.
      return { ok: true, stored: 'fcm_deferred' };
    }

    const endpoint = String(body.endpoint ?? '').trim();
    const p256dh = String(body.keys?.p256dh ?? '').trim();
    const auth = String(body.keys?.auth ?? '').trim();
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: 'invalid_subscription' };
    }

    await this.repo.upsertWeb({
      staffId,
      endpoint,
      p256dh,
      auth,
      userAgent: String(req.headers['user-agent'] ?? ''),
    });
    return { ok: true };
  }

  @Delete('subscribe')
  async unsubscribe(
    @Query('endpoint') endpointRaw: string | undefined,
    @Req() req: ReqWithStaff,
  ) {
    const staffId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    if (staffId == null) return { ok: false, error: 'staff_required' };
    const endpoint = String(endpointRaw ?? '').trim();
    if (!endpoint) return { ok: false, error: 'endpoint_required' };
    const removed = await this.repo.deleteWeb(staffId, endpoint);
    return { ok: removed };
  }
}
