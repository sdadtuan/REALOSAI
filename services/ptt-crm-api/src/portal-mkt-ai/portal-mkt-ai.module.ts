import { Module } from '@nestjs/common';
import { MarketingAiPlannerModule } from '../marketing-ai-planner/marketing-ai-planner.module';
import { PortalModule } from '../portal/portal.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { PortalMktAiController } from './portal-mkt-ai.controller';
import { PortalMktAiSummaryService } from './portal-mkt-ai-summary.service';

@Module({
  imports: [PortalModule, ServiceLifecycleModule, MarketingAiPlannerModule],
  controllers: [PortalMktAiController],
  providers: [PortalMktAiSummaryService],
  exports: [PortalMktAiSummaryService],
})
export class PortalMktAiModule {}
