import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GtmSandboxService } from './gtm-sandbox.service';

@Injectable()
export class GtmSandboxExpiryJob {
  constructor(private readonly sandbox: GtmSandboxService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiry(): Promise<void> {
    await this.sandbox.expireSandboxes(new Date());
  }
}
