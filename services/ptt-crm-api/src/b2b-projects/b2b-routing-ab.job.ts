import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { B2bRoutingAbService } from './b2b-routing-ab.service';

@Injectable()
export class B2bRoutingAbReportJob {
  private readonly logger = new Logger(B2bRoutingAbReportJob.name);

  constructor(private readonly routingAb: B2bRoutingAbService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async logWeeklyReport(): Promise<void> {
    try {
      const report = await this.routingAb.getReport(30);
      if (report.n > 0) {
        this.logger.log(
          `b2b routing ab 30d n=${report.n} ai_win=${report.ai_win_rate ?? 'n/a'} hybrid_win=${report.hybrid_win_rate ?? 'n/a'}`,
        );
      }
    } catch (err) {
      this.logger.error('b2b routing ab weekly report failed', err as Error);
    }
  }
}
