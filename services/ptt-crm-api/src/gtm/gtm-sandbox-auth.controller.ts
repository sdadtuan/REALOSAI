import { Body, Controller, Post } from '@nestjs/common';
import { GtmSandboxAuthService } from './gtm-sandbox-auth.service';

@Controller('api/v1/gtm/sandbox')
export class GtmSandboxAuthController {
  constructor(private readonly auth: GtmSandboxAuthService) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';
    return this.auth.login(username, password);
  }
}
