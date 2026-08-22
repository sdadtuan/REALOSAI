import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { B2bSlaTickService } from './b2b-sla-tick.service';

@Injectable()
export class B2bSlaTickJob {
  private readonly logger = new Logger(B2bSlaTickJob.name);

  constructor(private readonly tickService: B2bSlaTickService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTick(): Promise<void> {
    try {
      const out = await this.tickService.tick(new Date());
      if (out.hopped || out.queued || out.aiStarted) {
        this.logger.log(
          `b2b sla tick processed=${out.processed} hopped=${out.hopped} gdkd=${out.queued} ai=${out.aiStarted}`,
        );
      }
    } catch (err) {
      this.logger.error('b2b sla tick failed', err as Error);
    }
  }
}
