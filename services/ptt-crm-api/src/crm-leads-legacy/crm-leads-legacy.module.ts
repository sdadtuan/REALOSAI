import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { CustomerTimelineModule } from '../customer-timeline/customer-timeline.module';
import { LeadsModule } from '../leads/leads.module';
import { LeadsFunnelModule } from '../leads-funnel/leads-funnel.module';
import { LeadMeetingPrepAsyncModule } from '../lead-meeting-prep/lead-meeting-prep-async.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffNotificationsModule } from '../staff-notifications/staff-notifications.module';
import { CrmLeadsLegacyController } from './crm-leads-legacy.controller';
import { CrmLeadsLegacyService } from './crm-leads-legacy.service';
import { CrmLeadsPgRepository } from './crm-leads-pg.repository';

@Module({
  imports: [
    StaffAuthModule,
    StaffNotificationsModule,
    forwardRef(() => AiIntelligenceModule),
    forwardRef(() => LeadsModule),
    forwardRef(() => CustomerTimelineModule),
    forwardRef(() => LeadsFunnelModule),
    LeadMeetingPrepAsyncModule,
  ],
  controllers: [CrmLeadsLegacyController],
  providers: [CrmLeadsLegacyService, CrmLeadsPgRepository],
  exports: [CrmLeadsLegacyService, CrmLeadsPgRepository],
})
export class CrmLeadsLegacyModule {}
