import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isBdsHoldTtlEnabled, isBdsPackEnabled } from '../bds.flags';
import { BdsHoldService } from './bds-hold.service';

@Injectable()
export class BdsHoldTtlJob {
  constructor(private readonly holds: BdsHoldService) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (!isBdsPackEnabled() || !isBdsHoldTtlEnabled()) return;
    await this.holds.expireDue(new Date());
  }
}
