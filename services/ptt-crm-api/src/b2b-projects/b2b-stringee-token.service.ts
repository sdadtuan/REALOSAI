import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { createStringeeUserToken } from './b2b-cpaas-stringee.util';

@Injectable()
export class B2bStringeeTokenService {
  constructor(private readonly config: AppConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.stringeeApiKeySid &&
        this.config.stringeeApiKeySecret &&
        this.config.b2bCpaas === 'stringee',
    );
  }

  createStaffUserToken(staffId: number): { access_token: string; user_id: string } | null {
    const sid = this.config.stringeeApiKeySid;
    const secret = this.config.stringeeApiKeySecret;
    if (!sid || !secret) return null;
    const userId = `staff_${staffId}`;
    return {
      user_id: userId,
      access_token: createStringeeUserToken({
        apiKeySid: sid,
        apiKeySecret: secret,
        userId,
        ttlSec: 3600,
      }),
    };
  }
}
