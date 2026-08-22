import { forwardRef, Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { LeadMeetingPrepController } from './lead-meeting-prep.controller';
import { LeadMeetingPrepInternalController } from './lead-meeting-prep-internal.controller';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepLlmService } from './lead-meeting-prep-llm.service';
import { LmpSciAnalyticsService } from './lmp-sci-analytics.service';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';
import { LeadMeetingPrepEnabledGuard } from './guards/lead-meeting-prep-enabled.guard';
import { StaffLmpRunGuard, StaffLmpViewGuard } from './guards/staff-lmp.guard';

@Module({
  imports: [
    WebhooksModule,
    StaffAuthModule,
    AiIntelligenceModule,
    ProposalsModule,
    forwardRef(() => LeadsModule),
  ],
  controllers: [LeadMeetingPrepController, LeadMeetingPrepInternalController],
  providers: [
    LeadMeetingPrepRepository,
    LeadMeetingPrepInputResolver,
    LeadMeetingPrepEnqueueService,
    LeadMeetingPrepService,
    LeadMeetingPrepLlmService,
    LmpSciAnalyticsService,
    LeadMeetingPrepEnabledGuard,
    StaffLmpViewGuard,
    StaffLmpRunGuard,
  ],
  exports: [LeadMeetingPrepEnqueueService, LeadMeetingPrepRepository, LmpSciAnalyticsService],
})
export class LeadMeetingPrepModule {}
