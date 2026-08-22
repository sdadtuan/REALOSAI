import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { LmpSciAnalyticsService } from './lmp-sci-analytics.service';

/** Minimal LMP surface for modules that must not import full LeadMeetingPrepModule. */
@Module({
  imports: [WebhooksModule],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
    LmpSciAnalyticsService,
  ],
  exports: [LeadMeetingPrepEnqueueService, LeadMeetingPrepRepository, LmpSciAnalyticsService],
})
export class LeadMeetingPrepAsyncModule {}
