import { ForbiddenException, Injectable, Inject, Optional, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { signStaffJwt } from '../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { GTM_SANDBOX_STORE, type GtmSandboxStore } from './gtm-sandbox.store';

export const SANDBOX_VISITOR_POSITION_CODE = 'sandbox_visitor';
export const SANDBOX_VISITOR_POSITION_ID = 900_001;

export const SANDBOX_VISITOR_CAPS: StaffSectionCap[] = [
  { section: 'sandbox.leads', action: 'view' },
  { section: 'sandbox.board', action: 'view' },
];

export type SandboxLoginResult = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_expires_in: number;
  user: {
    id: string;
    email: string;
    display_name: string;
    position_id: number;
    position_code: typeof SANDBOX_VISITOR_POSITION_CODE;
    tenant: string;
    locale: 'en';
    caps: StaffSectionCap[];
  };
};

@Injectable()
export class GtmSandboxAuthService {
  constructor(
    private readonly config: AppConfigService,
    @Optional() @Inject(GTM_SANDBOX_STORE) private readonly store?: GtmSandboxStore,
  ) {}

  login(username: string, password: string): SandboxLoginResult {
    const normalized = username.trim();
    const account = this.store?.get(normalized);
    if (!account || account.password !== password) {
      throw new UnauthorizedException({ error: 'Invalid credentials' });
    }
    if (this.store?.isDisabled(normalized)) {
      throw new ForbiddenException({ code: 'sandbox_expired' });
    }
    const expiresAt = new Date(account.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new ForbiddenException({ code: 'sandbox_expired' });
    }

    const base = {
      sub: normalized,
      email: account.email,
      display_name: normalized,
      position_id: SANDBOX_VISITOR_POSITION_ID,
      tv: 0,
    };

    const accessToken = signStaffJwt(
      { ...base, token_type: 'access' },
      this.config.staffJwtSecret,
      this.config.staffJwtTtlSec,
    );
    const refreshToken = signStaffJwt(
      { ...base, token_type: 'refresh' },
      this.config.staffJwtSecret,
      this.config.staffRefreshTtlSec,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.config.staffJwtTtlSec,
      refresh_expires_in: this.config.staffRefreshTtlSec,
      user: {
        id: normalized,
        email: account.email,
        display_name: normalized,
        position_id: SANDBOX_VISITOR_POSITION_ID,
        position_code: SANDBOX_VISITOR_POSITION_CODE,
        tenant: account.tenant,
        locale: 'en',
        caps: SANDBOX_VISITOR_CAPS,
      },
    };
  }
}
