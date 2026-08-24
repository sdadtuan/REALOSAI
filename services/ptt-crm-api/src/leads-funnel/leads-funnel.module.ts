import { forwardRef, Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { CskhBoardModule } from '../cskh-board/cskh-board.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelController } from './leads-funnel.controller';
import { LeadsFunnelService } from './leads-funnel.service';
import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';
import { LeadsFunnelEnabledGuard, PresalesOnLeadGuard } from './guards/leads-funnel-enabled.guard';
import { LeadNotInReviewQueueGuard } from './guards/lead-not-in-review-queue.guard';
import { StaffLeadsGdkdGuard } from './guards/staff-leads-gdkd.guard';
import {
  StaffPresalesSolutionClaimGuard,
  StaffPresalesSolutionQueueGuard,
  StaffPresalesSolutionReleaseGuard,
} from './guards/staff-presales-solution.guard';
import { PolicyModule } from '../policy/policy.module';
import { IntakeModule } from '../intake/intake.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { MarketingAiOrchestratorService } from '../marketing-ai-planner/marketing-ai-orchestrator.service';
import { StaffMarketingAiPlannerGenerateGuard } from '../marketing-ai-planner/guards/staff-marketing-ai-planner.guard';
import { ReviewQueueLlmService } from './review-queue-llm.service';

@Module({
  imports: [
    StaffAuthModule,
    B2bProjectsModule,
    forwardRef(() => LeadsModule),
    forwardRef(() => CrmLeadsLegacyModule),
    forwardRef(() => CskhBoardModule),
    forwardRef(() => AiIntelligenceModule),
    forwardRef(() => IntakeModule),
    LeadMeetingPrepAsyncModule,
    PolicyModule,
  ],
  controllers: [LeadsFunnelController],
  providers: [
    LeadsFunnelService,
    LeadsFunnelPgRepository,
    ReviewQueueLlmService,
    MarketingAiOrchestratorService,
    LeadsFunnelEnabledGuard,
    PresalesOnLeadGuard,
    StaffLeadsGdkdGuard,
    LeadNotInReviewQueueGuard,
    StaffPresalesSolutionClaimGuard,
    StaffPresalesSolutionReleaseGuard,
    StaffPresalesSolutionQueueGuard,
    StaffMarketingAiPlannerGenerateGuard,
  ],
  exports: [LeadsFunnelService, LeadsFunnelPgRepository, LeadNotInReviewQueueGuard],
})
export class LeadsFunnelModule {}
