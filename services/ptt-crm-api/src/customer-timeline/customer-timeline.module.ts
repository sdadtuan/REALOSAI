import { Module, forwardRef } from '@nestjs/common';
import { CrmLeadsLegacyModule } from '../crm-leads-legacy/crm-leads-legacy.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AiTimelineController, CustomerTimelineController } from './customer-timeline.controller';
import { CustomerTimelineRepository } from './customer-timeline.repository';
import { CustomerTimelineService } from './customer-timeline.service';

@Module({
  imports: [StaffAuthModule, forwardRef(() => CrmLeadsLegacyModule)],
  controllers: [CustomerTimelineController, AiTimelineController],
  providers: [CustomerTimelineRepository, CustomerTimelineService],
  exports: [CustomerTimelineRepository, CustomerTimelineService],
})
export class CustomerTimelineModule {}
