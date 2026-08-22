import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import {
  StaffLoginResult,
  StaffMeResponse,
  StaffOidcExchangeBody,
  StaffRosterResponse,
  StaffSsoConfigResponse,
} from './staff-auth.types';
import { StaffJwtGuard, StaffUser } from './staff-jwt.guard';
import { StaffJwtPayload } from './staff-jwt.util';

class StaffLoginBody {
  email!: string;
  password!: string;
}

class StaffRefreshBody {
  refresh_token!: string;
}

@Controller('api/v1/staff/auth')
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Get('sso/config')
  ssoConfig(): StaffSsoConfigResponse {
    return this.auth.getSsoConfig();
  }

  @Post('oidc/exchange')
  @HttpCode(HttpStatus.OK)
  exchangeOidc(@Body() body: StaffOidcExchangeBody): Promise<StaffLoginResult> {
    return this.auth.exchangeOidc({
      code: body.code ?? '',
      redirectUri: body.redirect_uri ?? '',
      codeVerifier: body.code_verifier ?? '',
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: StaffLoginBody): Promise<StaffLoginResult> {
    return this.auth.login(body.email ?? '', body.password ?? '');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: StaffRefreshBody): Promise<StaffLoginResult> {
    return this.auth.refresh(body.refresh_token ?? '');
  }

  @Get('me')
  @UseGuards(StaffJwtGuard)
  async me(@StaffUser() user: StaffJwtPayload): Promise<StaffMeResponse> {
    return this.auth.me(user);
  }

  @Get('roster')
  @UseGuards(StaffJwtGuard)
  async roster(): Promise<StaffRosterResponse> {
    return this.auth.listActiveStaff();
  }
}
